import { construirContexto, DISPARADOR_APERTURA, SYSTEM_PROMPT, VERSION_PROMPT } from "../../lib/agent/prompt";
import { abrirConversacion } from "../../lib/agent/sesion";
import { DECLARACIONES, ejecutarTool } from "../../lib/agent/tools";
import type { Apertura, Turno } from "../../lib/agent/types";
import { respuestaSegura, type MotivoRechazo } from "../../lib/agent/validator";
import { obtenerClientePorId } from "../../lib/db/clientes";
import { agregarTurno, obtenerConversacion, obtenerTurnos } from "../../lib/db/conversaciones";
import { rehidratarSenal } from "../../lib/riesgo";
import { decidirTurno, validarHablado, type IntentoTurno } from "./compuerta";
import { leerConfigS2S } from "./config";
import { aToolsRealtime, construirInstruccionesS2S, FRECUENCIA_AUDIO_HZ } from "./protocolo";

/**
 * Lado servidor de la llamada speech-to-speech.
 *
 * El audio va directo del navegador a OpenAI por WebSocket (un Route Handler de Next no
 * puede sostener un WebSocket). Lo que NO puede pasar por el navegador vive acá:
 *
 * - **La API key.** El navegador recibe una clave efímera de 15 minutos, emitida con las
 *   instrucciones y las tools ya fijadas.
 * - **Las herramientas.** Leen y escriben con la service role, igual que en texto.
 * - **El validador y la persistencia.** El navegador no decide si algo suena: pregunta.
 *
 * La conversación se abre con `abrirConversacion` de `lib/agent/sesion.ts`, así que la
 * señal de riesgo, la decisión de contacto y el caso de control son exactamente los de
 * los otros dos canales.
 */

const URL_CLIENT_SECRETS = "https://api.openai.com/v1/realtime/client_secrets";
/** Alcanza para una llamada de cobranza (~3 min) con margen, y no queda viva de más. */
const VIGENCIA_CLAVE_S = 900;
const TIMEOUT_CLAVE_MS = 10_000;
/** Techo, no objetivo: la brevedad la garantiza el validador (3 frases). */
const MAX_TOKENS_RESPUESTA = 1024;

export class ErrorS2S extends Error {
  constructor(
    readonly codigo: string,
    mensaje: string,
    readonly estadoHttp: number,
  ) {
    super(mensaje);
    this.name = "ErrorS2S";
  }
}

// --- Abrir la llamada ------------------------------------------------------------------

export interface LlamadaAbierta {
  conversacionId: string;
  cliente: { nombre: string };
  clientSecret: string;
  expiraEn: number;
  modelo: string;
  voz: string;
  /** Cuando abre el agente, el navegador lo manda como primer mensaje. No se persiste. */
  disparadorApertura: string | null;
}

async function emitirClaveEfimera(params: {
  apiKey: string;
  modelo: string;
  voz: string;
  modeloTranscripcion: string;
  instrucciones: string;
}): Promise<{ valor: string; expiraEn: number }> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_CLAVE_MS);

  try {
    const res = await fetch(URL_CLIENT_SECRETS, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.apiKey}`, "Content-Type": "application/json" },
      signal: controlador.signal,
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: VIGENCIA_CLAVE_S },
        session: {
          type: "realtime",
          model: params.modelo,
          instructions: params.instrucciones,
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: FRECUENCIA_AUDIO_HZ },
              // La transcripción de la persona es la evidencia que queda en `turnos`, y la
              // que el validador usa para aceptar un monto que ella misma dijo.
              transcription: { model: params.modeloTranscripcion, language: "es" },
              // Push-to-talk, igual que el pipeline: sin VAD no se corta a alguien que
              // titubea hablando de plata, y la comparación entre enfoques es justa.
              turn_detection: null,
            },
            output: { format: { type: "audio/pcm", rate: FRECUENCIA_AUDIO_HZ }, voice: params.voz },
          },
          tools: aToolsRealtime(DECLARACIONES),
          tool_choice: "auto",
          max_output_tokens: MAX_TOKENS_RESPUESTA,
        },
      }),
    });

    const cuerpo = (await res.json().catch(() => null)) as {
      value?: unknown;
      expires_at?: unknown;
      error?: { message?: unknown };
    } | null;

    if (!res.ok || typeof cuerpo?.value !== "string") {
      const detalle = typeof cuerpo?.error?.message === "string" ? cuerpo.error.message : `HTTP ${res.status}`;
      throw new ErrorS2S("PROVEEDOR_S2S", `OpenAI no emitió la clave de la llamada: ${detalle}`, 502);
    }

    return {
      valor: cuerpo.value,
      expiraEn: typeof cuerpo.expires_at === "number" ? cuerpo.expires_at : 0,
    };
  } catch (e) {
    if (e instanceof ErrorS2S) throw e;
    const mensaje = e instanceof Error && e.name === "AbortError" ? "tiempo de espera agotado" : String(e);
    throw new ErrorS2S("PROVEEDOR_S2S", `No se pudo contactar a OpenAI: ${mensaje}`, 502);
  } finally {
    clearTimeout(temporizador);
  }
}

export async function abrirLlamadaS2S(params: {
  slug: string;
  apertura: Apertura;
  hoy?: Date;
}): Promise<LlamadaAbierta> {
  const config = leerConfigS2S();
  // Antes de abrir el registro: sin clave no hay llamada, y no tiene sentido dejar una
  // conversación abierta en la base que nunca va a tener un turno.
  if (config.apiKey === null) {
    throw new ErrorS2S(
      "S2S_NO_CONFIGURADO",
      "Falta OPENAI_API_KEY en .env.local: el canal speech-to-speech usa la Realtime API de OpenAI.",
      503,
    );
  }

  const hoy = params.hoy ?? new Date();
  const { conversacionId, cliente, senal } = await abrirConversacion({
    slug: params.slug,
    apertura: params.apertura,
    canal: "voz",
    modoVoz: "s2s",
    hoy,
  });

  const instrucciones = construirInstruccionesS2S(
    SYSTEM_PROMPT,
    construirContexto(cliente, params.apertura, hoy, senal, "voz"),
  );

  const clave = await emitirClaveEfimera({
    apiKey: config.apiKey,
    modelo: config.modelo,
    voz: config.voz,
    modeloTranscripcion: config.modeloTranscripcion,
    instrucciones,
  });

  return {
    conversacionId,
    cliente: { nombre: cliente.nombre },
    clientSecret: clave.valor,
    expiraEn: clave.expiraEn,
    modelo: config.modelo,
    voz: config.voz,
    disparadorApertura: params.apertura === "agente" ? DISPARADOR_APERTURA : null,
  };
}

// --- Contexto de una llamada ya abierta ---------------------------------------------

async function cargarLlamada(conversacionId: string) {
  const conversacion = await obtenerConversacion(conversacionId);
  if (!conversacion) throw new ErrorS2S("NOT_FOUND", "Esa conversación no existe.", 404);
  if (conversacion.canal !== "voz" || conversacion.modoVoz !== "s2s") {
    throw new ErrorS2S("CANAL_INVALIDO", "Esa conversación no es una llamada speech-to-speech.", 400);
  }

  const cliente = await obtenerClientePorId(conversacion.clienteId);
  if (!cliente) throw new ErrorS2S("NOT_FOUND", "El cliente de esa conversación no existe.", 404);

  return {
    conversacion,
    cliente,
    // La señal con la que se abrió: la llamada entera se explica con una sola señal.
    senal: conversacion.senal ? rehidratarSenal(conversacion.senal) : null,
  };
}

// --- Herramientas ---------------------------------------------------------------------

export async function ejecutarToolS2S(params: {
  conversacionId: string;
  nombre: string;
  argumentos: string;
}): Promise<{ salida: Record<string, unknown>; cerroConversacion: boolean }> {
  const { conversacion, cliente, senal } = await cargarLlamada(params.conversacionId);

  // Con el acuerdo ya registrado no se ejecuta nada más: registrar dos veces rompería la
  // restricción de `acuerdos` justo después del cierre.
  if (conversacion.estado !== "abierta") {
    return {
      salida: {
        error: "La conversación ya quedó registrada.",
        instruccion: "No llamés más herramientas. Despedite en una frase.",
      },
      cerroConversacion: false,
    };
  }

  let argumentos: Record<string, unknown>;
  try {
    const parseado: unknown = JSON.parse(params.argumentos);
    argumentos =
      typeof parseado === "object" && parseado !== null && !Array.isArray(parseado)
        ? (parseado as Record<string, unknown>)
        : {};
  } catch {
    argumentos = {};
  }

  const resultado = await ejecutarTool(params.nombre, argumentos, {
    cliente,
    conversacionId: params.conversacionId,
    hoy: new Date(),
    senal,
  });

  return { salida: resultado.salida, cerroConversacion: resultado.cerroConversacion };
}

// --- Compuerta y registro del turno -----------------------------------------------------

export type ResultadoTurnoS2S =
  | { accion: "reintentar"; motivo: MotivoRechazo; notaCorrectiva: string }
  | {
      accion: "reproducir" | "respuesta_segura";
      /** Lo que quedó en `turnos` y lo que se muestra. */
      texto: string;
      validadorOk: boolean;
      validadorMotivo: MotivoRechazo | null;
      latenciaValidadorMs: number;
      turnoId: string;
    };

export async function registrarTurnoS2S(params: {
  conversacionId: string;
  /** Lo que dijo la persona en este intercambio. `null` en el saludo inicial del agente. */
  textoCliente: string | null;
  /** La transcripción del audio que el modelo generó y que está retenido en el navegador. */
  textoAgente: string;
  /** `false` si la API marcó la respuesta como incompleta. */
  completa: boolean;
  intento: IntentoTurno;
  /** El motivo del rechazo anterior, si este es el segundo intento. */
  motivoPrevio: MotivoRechazo | null;
  metricas: { latenciaMs: number; tokensIn: number | null; tokensOut: number | null };
}): Promise<ResultadoTurnoS2S> {
  const { cliente, senal } = await cargarLlamada(params.conversacionId);
  const config = leerConfigS2S();

  const previos = await obtenerTurnos(params.conversacionId);
  const historial: Turno[] =
    params.textoCliente === null ? previos : [...previos, { rol: "cliente", texto: params.textoCliente }];

  const desde = Date.now();
  const validacion = validarHablado(params.textoAgente, params.completa, {
    cliente,
    historial,
    esPrimerMensajeDelAgente: !historial.some((t) => t.rol === "agente"),
    senal,
  });
  const latenciaValidadorMs = Date.now() - desde;

  const decision = decidirTurno(validacion, params.intento);

  // Nada se persiste en un rechazo con reintento: el turno todavía no existe.
  if (decision.accion === "reintentar") return decision;

  const texto = decision.accion === "reproducir" ? params.textoAgente : respuestaSegura(cliente);
  // Igual que el orquestador de texto: un reintento que salió bien igual cuenta como
  // intervención, y si terminó en respuesta segura queda el último motivo.
  const validadorMotivo = decision.accion === "reproducir" ? params.motivoPrevio : decision.motivo;

  // El turno de la persona se guarda recién ahora, junto al del agente, para que un
  // reintento no lo duplique.
  if (params.textoCliente !== null) {
    await agregarTurno({
      conversacionId: params.conversacionId,
      indice: previos.length,
      rol: "cliente",
      texto: params.textoCliente,
    });
  }

  const turnoId = await agregarTurno({
    conversacionId: params.conversacionId,
    indice: historial.length,
    rol: "agente",
    texto,
    metricas: {
      // Round-trip: el campo común con el pipeline. S2S no tiene etapas STT/LLM/TTS que
      // desglosar; el validador sí, porque también corre acá.
      latenciaMs: params.metricas.latenciaMs,
      tokensIn: params.metricas.tokensIn,
      tokensOut: params.metricas.tokensOut,
      validadorOk: validadorMotivo === null,
      validadorMotivo,
      modeloVersion: `${config.modelo}/${VERSION_PROMPT}`,
      latenciaSttMs: null,
      latenciaLlmMs: null,
      latenciaValidadorMs,
      latenciaTtsMs: null,
    },
  });

  return {
    accion: decision.accion,
    texto,
    validadorOk: validadorMotivo === null,
    validadorMotivo,
    latenciaValidadorMs,
    turnoId,
  };
}
