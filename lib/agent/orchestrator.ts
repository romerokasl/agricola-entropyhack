import { agregarTurno } from "../db/conversaciones";
import type { SenalRiesgo } from "../riesgo/types";
import { obtenerLlmProvider, type MensajeLlm } from "./llm";
import { construirContexto, DISPARADOR_APERTURA, SYSTEM_PROMPT, VERSION_PROMPT } from "./prompt";
import { DECLARACIONES, ejecutarTool } from "./tools";
import type { Apertura, Canal, Cliente, Turno } from "./types";
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
  /** Round-trip del turno. Campo común con S2S. */
  latenciaMs: number;
  /** Desglose por etapa. Lo que S2S no puede dar. */
  latenciaSttMs: number | null;
  latenciaLlmMs: number;
  latenciaValidadorMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  modeloVersion: string;
  cerroConversacion: boolean;
  /**
   * Para completar después la latencia del TTS, que ocurre una vez que el turno ya
   * está persistido.
   */
  turnoId: string;
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
  /**
   * La señal de alerta temprana de esta conversación (`lib/riesgo`). Se calcula una
   * sola vez al abrir y se reusa en cada turno: llamar al scorer por turno le sumaría
   * latencia a una respuesta que la persona está esperando, y además haría que el
   * registro de la conversación no tuviera una única señal que la explique.
   */
  senal?: SenalRiesgo | null;
  /** Texto o voz. Cambia cómo se redacta el turno, nunca qué se puede ofrecer. */
  canal?: Canal;
  /**
   * Cuánto tardó transcribir a la persona. Se recibe hecho porque la etapa STT ocurre
   * antes de este turno; acá solo se registra para que el desglose quede completo en la
   * misma fila.
   */
  latenciaSttMs?: number | null;
}): Promise<ResultadoTurno> {
  const { cliente, conversacionId, apertura, historial, senal } = params;
  const hoy = params.hoy ?? new Date();
  const canal = params.canal ?? "texto";

  const proveedor = obtenerLlmProvider();
  const contexto = construirContexto(cliente, apertura, hoy, senal, canal);
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

  // Se acumulan por etapa en vez de medir una sola vez: el ciclo de herramientas puede
  // llamar al modelo varias veces, y el validador corre hasta dos.
  let latenciaLlmMs = 0;
  let latenciaValidadorMs = 0;

  const cronometrar = async <T>(fn: () => Promise<T>, sumar: (ms: number) => void): Promise<T> => {
    const desde = Date.now();
    try {
      return await fn();
    } finally {
      sumar(Date.now() - desde);
    }
  };

  const validarCronometrado = (candidato: string, ctx: Parameters<typeof validar>[1]) => {
    const desde = Date.now();
    const r = validar(candidato, ctx);
    latenciaValidadorMs += Date.now() - desde;
    return r;
  };

  // --- Ciclo de herramientas -------------------------------------------------
  for (let iteracion = 0; iteracion < MAX_ITERACIONES_TOOLS; iteracion += 1) {
    const respuesta = await cronometrar(
      () =>
        proveedor.generar({
          systemPrompt: SYSTEM_PROMPT,
          contexto,
          historial: mensajes,
          tools: DECLARACIONES,
        }),
      (ms) => {
        latenciaLlmMs += ms;
      },
    );

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
        senal,
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
  const ctxValidacion = { cliente, historial, esPrimerMensajeDelAgente, senal };
  // Una respuesta cortada a media frase nunca se muestra, aunque el resto pase.
  const validacion = truncada
    ? {
        ok: false,
        motivo: "truncada" as const,
        notaCorrectiva: "Tu respuesta quedó cortada a la mitad. Escribila completa en 2 o 3 frases.",
      }
    : validarCronometrado(texto, ctxValidacion);

  // `validadorOk` registra si la respuesta pasó SIN intervención. Un reintento que
  // después salió bien igual cuenta como intervención: si no, la métrica "tasa de
  // intervención del validador" se subcontaría, y es una de las que se muestran.
  let motivoIntervencion = validacion.motivo;

  if (!validacion.ok && validacion.notaCorrectiva) {
    // Se copia afuera del closure: dentro del callback TypeScript ya no puede sostener
    // el estrechamiento que hizo el `if`.
    const notaCorrectiva = validacion.notaCorrectiva;
    const reintento = await cronometrar(
      () =>
        proveedor.generar({
          systemPrompt: SYSTEM_PROMPT,
          contexto,
          historial: mensajes,
          tools: DECLARACIONES,
          notaCorrectiva,
        }),
      (ms) => {
        latenciaLlmMs += ms;
      },
    );
    const segundaValidacion = validarCronometrado(reintento.texto, ctxValidacion);
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

  const latenciaMs = Date.now() - inicio;
  const latenciaSttMs = params.latenciaSttMs ?? null;
  const modeloVersion = `${proveedor.modeloVersion}/${VERSION_PROMPT}`;
  const validadorOk = motivoIntervencion === null;

  const turnoId = await agregarTurno({
    conversacionId,
    // El historial que llega ya incluye el turno del cliente de este intercambio,
    // así que el turno del agente va justo después.
    indice: historial.length,
    rol: "agente",
    texto,
    metricas: {
      latenciaMs,
      tokensIn,
      tokensOut,
      validadorOk,
      validadorMotivo: motivoIntervencion,
      modeloVersion,
      latenciaSttMs,
      latenciaLlmMs,
      latenciaValidadorMs,
      // El TTS todavía no corrió: se completa después con `registrarLatenciaTts`.
      latenciaTtsMs: null,
    },
  });

  return {
    texto,
    validadorOk,
    validadorMotivo: motivoIntervencion,
    latenciaMs,
    latenciaSttMs,
    latenciaLlmMs,
    latenciaValidadorMs,
    tokensIn,
    tokensOut,
    modeloVersion,
    cerroConversacion,
    turnoId,
  };
}
