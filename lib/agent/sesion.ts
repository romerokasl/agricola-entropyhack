import { obtenerClientePorId, obtenerClientePorSlug } from "../db/clientes";
import {
  agregarTurno,
  crearConversacion,
  obtenerConversacion,
  obtenerTurnos,
} from "../db/conversaciones";
import { obtenerSenalRiesgo, rehidratarSenal } from "../riesgo";
import type { SenalRiesgo } from "../riesgo/types";
import { diagnosticar } from "./calendario";
import { ejecutarTurno, type ResultadoTurno } from "./orchestrator";
import type { Apertura, Canal, Cliente, ModoVoz, Turno } from "./types";

/**
 * La conversación, sin canal.
 *
 * Acá vive todo lo que es igual en chat y en llamada: pedir la señal de riesgo, decidir
 * si el sistema tiene derecho a abrir, crear el registro, correr el turno y persistirlo.
 * `app/api/chat/route.ts` es un envoltorio HTTP sobre esto, y el orquestador de voz
 * (`voice/pipeline/`, `voice/speech-to-speech/`) va a ser otro envoltorio sobre lo
 * mismo — pasando `canal: "voz"` y su `modoVoz`.
 *
 * Es lo que exige el contrato de `voice/README.md`: una sola fuente de reglas, una
 * sola señal de riesgo y las mismas tablas, para que el dashboard pueda comparar los
 * dos enfoques de voz sin casos especiales.
 */

export type CodigoErrorSesion = "NOT_FOUND" | "NO_CONTACTAR" | "CERRADA" | "CANAL_INVALIDO";

export class ErrorSesion extends Error {
  constructor(
    readonly codigo: CodigoErrorSesion,
    mensaje: string,
    readonly estadoHttp: number,
  ) {
    super(mensaje);
    this.name = "ErrorSesion";
  }
}

export interface InicioConversacion {
  conversacionId: string;
  cliente: Cliente;
  senal: SenalRiesgo;
  /** Vacío cuando abre la persona: ahí el agente todavía no dijo nada. */
  turnos: Turno[];
  turno: ResultadoTurno | null;
}

export interface RespuestaConversacion {
  conversacionId: string;
  turno: ResultadoTurno;
  cerrada: boolean;
}

/**
 * El esquema exige `modo_voz` NOT NULL en voz y NULL en texto. Se valida acá para que
 * un error de integración salga como un mensaje entendible y no como una violación de
 * constraint a mitad del demo.
 */
function validarCanal(canal: Canal, modoVoz: ModoVoz | null): void {
  if (canal === "voz" && modoVoz === null) {
    throw new ErrorSesion(
      "CANAL_INVALIDO",
      'Una conversación de voz necesita modoVoz: "pipeline" o "s2s".',
      400,
    );
  }
  if (canal === "texto" && modoVoz !== null) {
    throw new ErrorSesion("CANAL_INVALIDO", "Una conversación de texto no lleva modoVoz.", 400);
  }
}

export async function iniciarConversacion(params: {
  slug: string;
  apertura: Apertura;
  canal?: Canal;
  modoVoz?: ModoVoz | null;
  hoy?: Date;
}): Promise<InicioConversacion> {
  const canal = params.canal ?? "texto";
  const modoVoz = params.modoVoz ?? null;
  const hoy = params.hoy ?? new Date();

  validarCanal(canal, modoVoz);

  const cliente = await obtenerClientePorSlug(params.slug);
  if (!cliente) {
    throw new ErrorSesion("NOT_FOUND", `No existe el cliente "${params.slug}".`, 404);
  }

  // El scorer corre UNA vez, acá, antes de decidir nada. Nunca lanza: si el servicio
  // de Python está caído cae al score de lote y el flujo sigue igual.
  const senal = await obtenerSenalRiesgo(cliente, hoy);
  const dx = diagnosticar(cliente, hoy, senal);

  // El caso de control: el sistema se niega a abrir con quien no hay por qué
  // contactar. Que la persona escriba o llame primero siempre se permite — eso es
  // soporte, no cobranza.
  if (params.apertura === "agente" && dx.motivo === null) {
    throw new ErrorSesion(
      "NO_CONTACTAR",
      `El sistema no abre conversación con ${cliente.nombre}: ${dx.detalle}`,
      409,
    );
  }

  const conversacion = await crearConversacion({
    clienteId: cliente.id,
    canal,
    modoVoz,
    apertura: params.apertura,
    senal,
    // Solo cuando abre el sistema: si abrió la persona, no hubo "motivo de contacto".
    motivoContacto: params.apertura === "agente" ? dx.motivo : null,
  });

  if (params.apertura === "cliente") {
    return { conversacionId: conversacion.id, cliente, senal, turnos: [], turno: null };
  }

  const turno = await ejecutarTurno({
    cliente,
    conversacionId: conversacion.id,
    apertura: params.apertura,
    historial: [],
    hoy,
    senal,
    canal,
  });

  return {
    conversacionId: conversacion.id,
    cliente,
    senal,
    turnos: [{ rol: "agente", texto: turno.texto }],
    turno,
  };
}

export async function continuarConversacion(params: {
  conversacionId: string;
  texto: string;
  hoy?: Date;
  /**
   * Cuánto tardó transcribir a la persona, cuando el canal es de voz. Viaja hasta la
   * fila del turno para que el desglose por etapa quede completo en un solo lugar.
   */
  latenciaSttMs?: number | null;
}): Promise<RespuestaConversacion> {
  const hoy = params.hoy ?? new Date();

  const conversacion = await obtenerConversacion(params.conversacionId);
  if (!conversacion) throw new ErrorSesion("NOT_FOUND", "Esa conversación no existe.", 404);
  if (conversacion.estado !== "abierta") {
    throw new ErrorSesion("CERRADA", "Esa conversación ya está cerrada.", 409);
  }

  const cliente = await obtenerClientePorId(conversacion.clienteId);
  if (!cliente) {
    throw new ErrorSesion("NOT_FOUND", "El cliente de esa conversación no existe.", 404);
  }

  // Se lee el historial una sola vez y se arma en memoria, en vez de releerlo
  // después de insertar: son dos viajes menos a la base por turno.
  const previos = await obtenerTurnos(params.conversacionId);
  await agregarTurno({
    conversacionId: params.conversacionId,
    indice: previos.length,
    rol: "cliente",
    texto: params.texto,
  });
  const historial: Turno[] = [...previos, { rol: "cliente", texto: params.texto }];

  const turno = await ejecutarTurno({
    cliente,
    conversacionId: params.conversacionId,
    apertura: conversacion.apertura,
    historial,
    hoy,
    // La señal con la que se abrió, no una nueva: la conversación entera se explica
    // con una sola señal auditable.
    senal: conversacion.senal ? rehidratarSenal(conversacion.senal) : null,
    canal: conversacion.canal,
    latenciaSttMs: params.latenciaSttMs ?? null,
  });

  return {
    conversacionId: params.conversacionId,
    turno,
    cerrada: turno.cerroConversacion,
  };
}
