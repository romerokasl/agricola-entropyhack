import {
  validar,
  type ContextoValidacion,
  type MotivoRechazo,
  type ResultadoValidacion,
} from "../../lib/agent/validator";

/**
 * La compuerta del validador en speech-to-speech.
 *
 * El problema que resuelve: un modelo audio-a-audio no tiene un paso de texto entre el
 * modelo y el parlante donde meter el validador. La solución de esta implementación es
 * **retener el audio**: el navegador junta el audio de la respuesta sin reproducirlo, el
 * servidor valida la transcripción que el modelo emite de ese mismo audio, y solo si pasa
 * se reproduce. Lo que no pasa nunca suena.
 *
 * Es la misma política que `lib/agent/orchestrator.ts`: un reintento correctivo y, si
 * vuelve a fallar, la respuesta segura. Se separa en funciones puras para verificar la
 * decisión sin red.
 */

export const MOTIVOS_RECHAZO = [
  "palabra_prohibida",
  "otro_banco",
  "demasiadas_frases",
  "demasiadas_exclamaciones",
  "monto_inventado",
  "falta_presentacion",
  "escalon_invalido",
  "truncada",
  "vacia",
] as const satisfies readonly MotivoRechazo[];

/** Si el validador suma un motivo y esta lista no, esto deja de compilar. */
export const MOTIVOS_COMPLETOS: Exclude<MotivoRechazo, (typeof MOTIVOS_RECHAZO)[number]> extends never
  ? true
  : never = true;

export const NOTA_TRUNCADA =
  "Tu respuesta quedó cortada a la mitad. Decila completa en 2 o 3 frases.";

/**
 * Valida lo que el modelo dijo. Una respuesta que la API marcó como incompleta nunca
 * suena, aunque el tramo que alcanzó a decir pase: es la misma regla que el canal de
 * texto aplica a una respuesta truncada.
 */
export function validarHablado(
  transcripcion: string,
  completa: boolean,
  ctx: ContextoValidacion,
): ResultadoValidacion {
  if (!completa) return { ok: false, motivo: "truncada", notaCorrectiva: NOTA_TRUNCADA };
  return validar(transcripcion, ctx);
}

export type IntentoTurno = 1 | 2;

export type DecisionTurno =
  | { accion: "reproducir" }
  | { accion: "reintentar"; motivo: MotivoRechazo; notaCorrectiva: string }
  | { accion: "respuesta_segura"; motivo: MotivoRechazo };

export function decidirTurno(validacion: ResultadoValidacion, intento: IntentoTurno): DecisionTurno {
  if (validacion.ok) return { accion: "reproducir" };
  const motivo = validacion.motivo ?? "vacia";
  if (intento === 1 && validacion.notaCorrectiva) {
    return { accion: "reintentar", motivo, notaCorrectiva: validacion.notaCorrectiva };
  }
  return { accion: "respuesta_segura", motivo };
}
