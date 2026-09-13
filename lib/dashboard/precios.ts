/**
 * Precios de lista de los modelos que rota lib/agent/llm.ts.
 *
 * Verificados contra la página oficial el 12 de septiembre de 2026 (la página dice
 * "Last updated 2026-09-11 UTC"). Tier pagado, modalidad Standard, USD por millón de
 * tokens, entrada de texto.
 *
 * Dos límites que hay que decir en voz alta si alguien pregunta por el costo:
 * - El demo corre en el tier GRATUITO: el costo real hoy es $0. Esto es lo que costaría
 *   en producción.
 * - El precio de salida de Google incluye los tokens de razonamiento, pero
 *   `turnos.tokens_out` guarda `candidatesTokenCount`, que no los incluye. El costo
 *   calculado es un piso, no el total.
 *
 * Un modelo que no esté acá se reporta como "sin precio": no se estima.
 */

export interface PrecioModelo {
  entradaPorMillonUsd: number;
  salidaPorMillonUsd: number;
}

export const PRECIOS_FUENTE = "https://ai.google.dev/gemini-api/docs/pricing";
export const PRECIOS_VIGENTES_AL = "2026-09-11";

const PRECIOS = new Map<string, PrecioModelo>([
  // Los tres 3.x-flash duplican su precio a partir del 1 de enero de 2027.
  ["gemini-3.8-flash", { entradaPorMillonUsd: 0.75, salidaPorMillonUsd: 3.75 }],
  ["gemini-3.7-flash", { entradaPorMillonUsd: 0.75, salidaPorMillonUsd: 3.75 }],
  ["gemini-3.6-flash", { entradaPorMillonUsd: 0.75, salidaPorMillonUsd: 3.75 }],
  ["gemini-3.5-flash", { entradaPorMillonUsd: 1.5, salidaPorMillonUsd: 9.0 }],
  ["gemini-3.1-flash-lite", { entradaPorMillonUsd: 0.25, salidaPorMillonUsd: 1.5 }],
]);

export function precioDe(modelo: string): PrecioModelo | null {
  return PRECIOS.get(modelo) ?? null;
}
