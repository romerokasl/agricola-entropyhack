import type { DeclaracionTool } from "../../lib/agent/llm";

/**
 * El protocolo de la Realtime API de OpenAI, reducido a lo que usa esta llamada.
 *
 * Isomórfico y sin I/O: lo importan el navegador (`cliente/llamada.ts`), el servidor
 * (`servidor.ts`) y la verificación sin red (`scripts/verificar-s2s.ts`). Los nombres de
 * eventos son los de la API GA, verificados contra la referencia de eventos de cliente y
 * de servidor (septiembre 2026).
 */

/** La API trabaja en PCM 16 bits mono a 24 kHz, tanto de entrada como de salida. */
export const FRECUENCIA_AUDIO_HZ = 24_000;

/** Un commit con menos de 100 ms de audio lo rechaza la API: se descarta antes. */
export const AUDIO_MINIMO_MS = 100;

export const URL_REALTIME = "wss://api.openai.com/v1/realtime";

// --- Tools ------------------------------------------------------------------------

export interface ToolRealtime {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Las MISMAS declaraciones que usa el canal de texto y el pipeline, en el formato de la
 * Realtime API. No hay una lista propia de S2S: es el contrato de `voice/README.md`.
 */
export function aToolsRealtime(declaraciones: readonly DeclaracionTool[]): ToolRealtime[] {
  return declaraciones.map((d) => ({
    type: "function",
    name: d.nombre,
    description: d.descripcion,
    parameters: d.parametros,
  }));
}

// --- Instrucciones -----------------------------------------------------------------

/**
 * Lo único que S2S agrega al prompt compartido. Las reglas, la escalera y la guía de voz
 * (`GUIA_DE_VOZ`, que ya entra por `construirContexto` con canal "voz") no se repiten.
 */
export const GUIA_S2S = [
  "### ESTA LLAMADA ES AUDIO A AUDIO",
  "Respondé siempre en español salvadoreño, con voseo natural, en 2 o 3 frases.",
  "No anunciés que vas a consultar o registrar algo: llamá la herramienta directamente y",
  "hablá cuando tengas el resultado. Lo que digas junto a una llamada a herramienta no",
  "le llega a la persona.",
].join("\n");

export function construirInstruccionesS2S(systemPrompt: string, contexto: string): string {
  return [systemPrompt, contexto, GUIA_S2S].join("\n\n");
}

// --- Eventos de cliente ------------------------------------------------------------

export interface EventoCliente {
  type: string;
  [campo: string]: unknown;
}

export const eventos = {
  agregarAudio: (base64: string): EventoCliente => ({ type: "input_audio_buffer.append", audio: base64 }),
  confirmarAudio: (): EventoCliente => ({ type: "input_audio_buffer.commit" }),
  limpiarAudio: (): EventoCliente => ({ type: "input_audio_buffer.clear" }),

  /** `sinHerramientas` fuerza una respuesta hablada: es el techo del ciclo de tools. */
  pedirRespuesta: (sinHerramientas = false): EventoCliente =>
    sinHerramientas
      ? { type: "response.create", response: { tool_choice: "none" } }
      : { type: "response.create" },

  mensajeUsuario: (texto: string): EventoCliente => ({
    type: "conversation.item.create",
    item: { type: "message", role: "user", content: [{ type: "input_text", text: texto }] },
  }),

  /** La nota correctiva del validador entra como mensaje de sistema, igual que en texto. */
  mensajeSistema: (texto: string): EventoCliente => ({
    type: "conversation.item.create",
    item: { type: "message", role: "system", content: [{ type: "input_text", text: texto }] },
  }),

  /**
   * Lo que el agente dijo de verdad cuando habló la respuesta segura. Sin esto el modelo
   * no sabría qué escuchó la persona y el turno siguiente no tendría sentido.
   */
  mensajeAgente: (texto: string): EventoCliente => ({
    type: "conversation.item.create",
    item: { type: "message", role: "assistant", content: [{ type: "output_text", text: texto }] },
  }),

  resultadoTool: (callId: string, salida: Record<string, unknown>): EventoCliente => ({
    type: "conversation.item.create",
    item: { type: "function_call_output", call_id: callId, output: JSON.stringify(salida) },
  }),

  borrarItem: (itemId: string): EventoCliente => ({ type: "conversation.item.delete", item_id: itemId }),

  /** Le dice al modelo hasta dónde se escuchó su audio cuando la persona lo interrumpe. */
  truncarItem: (itemId: string, audioFinMs: number): EventoCliente => ({
    type: "conversation.item.truncate",
    item_id: itemId,
    content_index: 0,
    audio_end_ms: Math.max(0, Math.round(audioFinMs)),
  }),
};

// --- Eventos de servidor -----------------------------------------------------------

export interface LlamadaFuncion {
  callId: string;
  nombre: string;
  /** JSON crudo tal como lo mandó el modelo. Lo parsea y valida el servidor. */
  argumentos: string;
}

export interface UsoRespuesta {
  tokensIn: number;
  tokensOut: number;
}

export type EventoServidor =
  | { type: "session.created" | "session.updated" }
  | { type: "error"; mensaje: string; codigo: string | null }
  | { type: "input_audio_buffer.committed"; itemId: string }
  | { type: "conversation.item.input_audio_transcription.completed"; itemId: string; transcripcion: string }
  | { type: "conversation.item.input_audio_transcription.failed"; itemId: string }
  | { type: "response.created"; responseId: string }
  | { type: "response.output_item.added"; itemId: string; tipoItem: string }
  | { type: "response.output_audio.delta"; itemId: string; delta: string }
  | { type: "response.output_audio_transcript.delta"; itemId: string; delta: string }
  | { type: "response.output_audio_transcript.done"; itemId: string; transcripcion: string }
  | { type: "response.function_call_arguments.done"; llamada: LlamadaFuncion }
  | {
      type: "response.done";
      responseId: string | null;
      estado: string;
      uso: UsoRespuesta | null;
      llamadas: LlamadaFuncion[];
    }
  | { type: "desconocido"; tipoOriginal: string | null };

type Objeto = Record<string, unknown>;

const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

function cadena(o: Objeto, clave: string): string | null {
  const v = o[clave];
  return typeof v === "string" ? v : null;
}

function numero(o: Objeto, clave: string): number | null {
  const v = o[clave];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const desconocido = (tipoOriginal: string | null): EventoServidor => ({ type: "desconocido", tipoOriginal });

function llamadaDesde(o: Objeto): LlamadaFuncion | null {
  const callId = cadena(o, "call_id");
  const nombre = cadena(o, "name");
  if (callId === null || nombre === null) return null;
  return { callId, nombre, argumentos: cadena(o, "arguments") ?? "{}" };
}

/**
 * Traduce un mensaje del WebSocket a un evento tipado. Nunca lanza: lo que no se entiende
 * vuelve como `desconocido`, porque la API manda muchos eventos que esta llamada ignora.
 */
export function interpretarEvento(crudo: string): EventoServidor {
  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    return desconocido(null);
  }
  if (!esObjeto(dato)) return desconocido(null);

  const tipo = cadena(dato, "type");
  const itemId = cadena(dato, "item_id") ?? "";

  switch (tipo) {
    case "session.created":
    case "session.updated":
      return { type: tipo };

    case "error": {
      const error = esObjeto(dato.error) ? dato.error : {};
      return {
        type: "error",
        mensaje: cadena(error, "message") ?? "Error sin descripción",
        codigo: cadena(error, "code"),
      };
    }

    case "input_audio_buffer.committed":
      return { type: tipo, itemId };

    case "conversation.item.input_audio_transcription.completed":
      return { type: tipo, itemId, transcripcion: cadena(dato, "transcript") ?? "" };

    case "conversation.item.input_audio_transcription.failed":
      return { type: tipo, itemId };

    case "response.created": {
      const id = esObjeto(dato.response) ? cadena(dato.response, "id") : null;
      return id === null ? desconocido(tipo) : { type: tipo, responseId: id };
    }

    case "response.output_item.added": {
      if (!esObjeto(dato.item)) return desconocido(tipo);
      const id = cadena(dato.item, "id");
      return id === null ? desconocido(tipo) : { type: tipo, itemId: id, tipoItem: cadena(dato.item, "type") ?? "" };
    }

    case "response.output_audio.delta":
    case "response.output_audio_transcript.delta":
      return { type: tipo, itemId, delta: cadena(dato, "delta") ?? "" };

    case "response.output_audio_transcript.done":
      return { type: tipo, itemId, transcripcion: cadena(dato, "transcript") ?? "" };

    case "response.function_call_arguments.done": {
      const llamada = llamadaDesde(dato);
      return llamada === null ? desconocido(tipo) : { type: tipo, llamada };
    }

    case "response.done": {
      const r = esObjeto(dato.response) ? dato.response : {};
      const usage = esObjeto(r.usage) ? r.usage : null;
      const salida = Array.isArray(r.output) ? r.output : [];
      return {
        type: tipo,
        responseId: cadena(r, "id"),
        estado: cadena(r, "status") ?? "failed",
        uso:
          usage === null
            ? null
            : { tokensIn: numero(usage, "input_tokens") ?? 0, tokensOut: numero(usage, "output_tokens") ?? 0 },
        llamadas: salida
          .filter(esObjeto)
          .filter((item) => cadena(item, "type") === "function_call")
          .map(llamadaDesde)
          .filter((l): l is LlamadaFuncion => l !== null),
      };
    }

    default:
      return desconocido(tipo);
  }
}

// --- Acumulador de una respuesta -----------------------------------------------------

export type EstadoRespuesta = "en_curso" | "completada" | "cancelada" | "incompleta" | "fallida";

const ESTADOS_API: Record<string, EstadoRespuesta> = {
  completed: "completada",
  cancelled: "cancelada",
  incomplete: "incompleta",
  failed: "fallida",
};

export interface RespuestaAcumulada {
  responseId: string | null;
  /** Items de mensaje del asistente. Se borran del contexto si la respuesta no suena. */
  itemsMensaje: string[];
  transcripciones: Array<{ itemId: string; texto: string; final: boolean }>;
  /** Trozos de PCM 16 en base64, en orden de llegada. */
  audio: string[];
  llamadas: LlamadaFuncion[];
  uso: UsoRespuesta | null;
  estado: EstadoRespuesta;
}

export function respuestaVacia(): RespuestaAcumulada {
  return {
    responseId: null,
    itemsMensaje: [],
    transcripciones: [],
    audio: [],
    llamadas: [],
    uso: null,
    estado: "en_curso",
  };
}

function registrarItem(r: RespuestaAcumulada, itemId: string): void {
  if (itemId !== "" && !r.itemsMensaje.includes(itemId)) r.itemsMensaje.push(itemId);
}

function tramoDe(r: RespuestaAcumulada, itemId: string) {
  let tramo = r.transcripciones.find((t) => t.itemId === itemId);
  if (!tramo) {
    tramo = { itemId, texto: "", final: false };
    r.transcripciones.push(tramo);
  }
  return tramo;
}

function agregarLlamada(r: RespuestaAcumulada, llamada: LlamadaFuncion): void {
  if (!r.llamadas.some((l) => l.callId === llamada.callId)) r.llamadas.push(llamada);
}

/**
 * Suma un evento a la respuesta en curso. Muta y devuelve el mismo objeto: una respuesta
 * hablada son cientos de trozos de audio, y copiar el arreglo en cada uno sería cuadrático.
 */
export function acumular(r: RespuestaAcumulada, evento: EventoServidor): RespuestaAcumulada {
  switch (evento.type) {
    case "response.created":
      r.responseId = evento.responseId;
      break;
    case "response.output_item.added":
      if (evento.tipoItem === "message") registrarItem(r, evento.itemId);
      break;
    case "response.output_audio.delta":
      registrarItem(r, evento.itemId);
      if (evento.delta !== "") r.audio.push(evento.delta);
      break;
    case "response.output_audio_transcript.delta": {
      registrarItem(r, evento.itemId);
      const tramo = tramoDe(r, evento.itemId);
      if (!tramo.final) tramo.texto += evento.delta;
      break;
    }
    case "response.output_audio_transcript.done": {
      registrarItem(r, evento.itemId);
      const tramo = tramoDe(r, evento.itemId);
      // La transcripción final manda sobre la suma de deltas.
      if (evento.transcripcion !== "") tramo.texto = evento.transcripcion;
      tramo.final = true;
      break;
    }
    case "response.function_call_arguments.done":
      agregarLlamada(r, evento.llamada);
      break;
    case "response.done":
      r.responseId = r.responseId ?? evento.responseId;
      r.estado = ESTADOS_API[evento.estado] ?? "fallida";
      r.uso = evento.uso;
      for (const llamada of evento.llamadas) agregarLlamada(r, llamada);
      break;
    default:
      break;
  }
  return r;
}

/** Lo que el modelo dijo, según su propia transcripción del audio. Es lo que se valida. */
export function textoDeRespuesta(r: RespuestaAcumulada): string {
  return r.transcripciones
    .map((t) => t.texto.trim())
    .filter((t) => t.length > 0)
    .join(" ");
}

export function sumarUso(a: UsoRespuesta | null, b: UsoRespuesta | null): UsoRespuesta | null {
  if (a === null) return b;
  if (b === null) return a;
  return { tokensIn: a.tokensIn + b.tokensIn, tokensOut: a.tokensOut + b.tokensOut };
}
