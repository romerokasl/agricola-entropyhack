/**
 * Configuración del proveedor speech-to-speech. Solo servidor: lee la API key.
 *
 * Modelo por defecto `gpt-realtime-2.1`, la decisión de `docs/criterios-comparacion-voz.md`
 * §8 (MCP y function calling asíncrono frente a Gemini Live).
 */

const VOCES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;

export type VozRealtime = (typeof VOCES)[number];

export interface ConfigS2S {
  apiKey: string | null;
  modelo: string;
  /** OpenAI recomienda `marin` o `cedar` para conversación. */
  voz: VozRealtime;
  /** Transcribe a la persona para la transcripción auditable y el validador de montos. */
  modeloTranscripcion: string;
}

/** El valor de ejemplo de `.env.example` cuenta como "no configurada". */
function clave(valor: string | undefined): string | null {
  const limpio = valor?.trim() ?? "";
  return limpio === "" || limpio.startsWith("your-") ? null : limpio;
}

export function leerConfigS2S(): ConfigS2S {
  const vozPedida = process.env.OPENAI_REALTIME_VOICE?.trim();
  return {
    apiKey: clave(process.env.OPENAI_API_KEY),
    modelo: process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1",
    voz: VOCES.find((v) => v === vozPedida) ?? "marin",
    modeloTranscripcion: process.env.OPENAI_REALTIME_TRANSCRIPCION?.trim() || "gpt-4o-transcribe",
  };
}
