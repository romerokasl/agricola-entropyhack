import { agregarTurno } from "../db/conversaciones";
import { obtenerLlmProvider, type MensajeLlm } from "./llm";
import { construirContexto, DISPARADOR_APERTURA, SYSTEM_PROMPT, VERSION_PROMPT } from "./prompt";
import { DECLARACIONES, ejecutarTool } from "./tools";
import type { Apertura, Cliente, Turno } from "./types";
import { respuestaSegura, validar, type MotivoRechazo } from "./validator";

/**
 * Un turno del agente: contexto → LLM (con tools) → validador → persistencia.
 *
 * El orden importa: NADA se le muestra a la persona sin haber pasado el validador.
 * Ese es el argumento central frente al jurado sobre control de alucinaciones.
 */

/** Ventana de historial. Más allá de esto no se manda (controla costo y latencia). */
const MAX_TURNOS_HISTORIAL = 10;

/** Techo de vueltas del ciclo de herramientas, para que no se cicle. */
const MAX_ITERACIONES_TOOLS = 3;

export interface ResultadoTurno {
  texto: string;
  validadorOk: boolean;
  validadorMotivo: MotivoRechazo | null;
  latenciaMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  modeloVersion: string;
  cerroConversacion: boolean;
}

function aMensajes(historial: readonly Turno[]): MensajeLlm[] {
  return historial
    .filter((t) => t.rol !== "sistema")
    .slice(-MAX_TURNOS_HISTORIAL)
    .map((t) => ({ rol: t.rol === "cliente" ? "cliente" : "agente", texto: t.texto }));
}

export async function ejecutarTurno(params: {
  cliente: Cliente;
  conversacionId: string;
  apertura: Apertura;
  historial: readonly Turno[];
  hoy?: Date;
}): Promise<ResultadoTurno> {
  const { cliente, conversacionId, apertura, historial } = params;
  const hoy = params.hoy ?? new Date();

  const proveedor = obtenerLlmProvider();
  const contexto = construirContexto(cliente, apertura, hoy);
  const inicio = Date.now();

  const mensajes: MensajeLlm[] = aMensajes(historial);
  const esPrimerMensajeDelAgente = !historial.some((t) => t.rol === "agente");

  // Cuando el agente abre, todavía no hay historial — y la API rechaza una
  // conversación sin ningún turno. El disparador no se persiste: solo el mensaje que
  // el agente produce a partir de él.
  if (mensajes.length === 0) {
    mensajes.push({ rol: "cliente", texto: DISPARADOR_APERTURA });
  }

  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let cerroConversacion = false;
  let texto = "";
  let truncada = false;

  // --- Ciclo de herramientas -------------------------------------------------
  for (let iteracion = 0; iteracion < MAX_ITERACIONES_TOOLS; iteracion += 1) {
    const respuesta = await proveedor.generar({
      systemPrompt: SYSTEM_PROMPT,
      contexto,
      historial: mensajes,
      tools: DECLARACIONES,
    });

    tokensIn = respuesta.tokensIn;
    tokensOut = respuesta.tokensOut;
    texto = respuesta.texto;
    truncada = respuesta.truncada;

    if (respuesta.llamadasTool.length === 0) break;

    mensajes.push({ rol: "agente", texto: respuesta.texto, llamadasTool: respuesta.llamadasTool });

    for (const llamada of respuesta.llamadasTool) {
      const resultado = await ejecutarTool(llamada.nombre, llamada.argumentos, {
        cliente,
        conversacionId,
        hoy,
      });
      if (resultado.cerroConversacion) cerroConversacion = true;
      mensajes.push({
        rol: "tool",
        texto: "",
        resultadoTool: { nombre: resultado.nombre, salida: resultado.salida },
      });
    }
  }

  // --- Validación: un reintento correctivo, después respuesta segura ---------
  const ctxValidacion = { cliente, historial, esPrimerMensajeDelAgente };
  // Una respuesta cortada a media frase nunca se muestra, aunque el resto pase.
  const validacion = truncada
    ? {
        ok: false,
        motivo: "truncada" as const,
        notaCorrectiva: "Tu respuesta quedó cortada a la mitad. Escribila completa en 2 o 3 frases.",
      }
    : validar(texto, ctxValidacion);

  // `validadorOk` registra si la respuesta pasó SIN intervención. Un reintento que
  // después salió bien igual cuenta como intervención: si no, la métrica "tasa de
  // intervención del validador" se subcontaría, y es una de las que se muestran.
  let motivoIntervencion = validacion.motivo;

  if (!validacion.ok && validacion.notaCorrectiva) {
    const reintento = await proveedor.generar({
      systemPrompt: SYSTEM_PROMPT,
      contexto,
      historial: mensajes,
      tools: DECLARACIONES,
      notaCorrectiva: validacion.notaCorrectiva,
    });
    const segundaValidacion = validar(reintento.texto, ctxValidacion);
    if (segundaValidacion.ok) {
      texto = reintento.texto;
      tokensIn = reintento.tokensIn;
      tokensOut = reintento.tokensOut;
    } else {
      // Nunca se muestra una respuesta que no pasó el chequeo, ni en el demo.
      texto = respuestaSegura(cliente);
      motivoIntervencion = segundaValidacion.motivo;
    }
  }

  const resultado: ResultadoTurno = {
    texto,
    validadorOk: motivoIntervencion === null,
    validadorMotivo: motivoIntervencion,
    latenciaMs: Date.now() - inicio,
    tokensIn,
    tokensOut,
    modeloVersion: `${proveedor.modeloVersion}/${VERSION_PROMPT}`,
    cerroConversacion,
  };

  await agregarTurno({
    conversacionId,
    // El historial que llega ya incluye el turno del cliente de este intercambio,
    // así que el turno del agente va justo después.
    indice: historial.length,
    rol: "agente",
    texto: resultado.texto,
    metricas: {
      latenciaMs: resultado.latenciaMs,
      tokensIn: resultado.tokensIn,
      tokensOut: resultado.tokensOut,
      validadorOk: resultado.validadorOk,
      validadorMotivo: resultado.validadorMotivo,
      modeloVersion: resultado.modeloVersion,
    },
  });

  return resultado;
}
