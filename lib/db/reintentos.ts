/**
 * Reintentos para fallos transitorios de Supabase.
 *
 * En el tier gratuito la API responde de vez en cuando con Gateway Timeout o corta la
 * conexión, sobre todo cuando el proyecto estuvo inactivo. Un fallo así a mitad del
 * pitch se ve igual que un bug, y el banco pide explícitamente un "demo estable".
 *
 * Solo se reintenta lo transitorio: un error de esquema o de permisos no mejora por
 * insistir, así que se propaga de una.
 */

const PATRONES_TRANSITORIOS = [
  "gateway timeout",
  "fetch failed",
  "timeout",
  "econnreset",
  "socket hang up",
  "service unavailable",
  "502",
  "503",
  "504",
];

const REINTENTOS = 3;
const ESPERA_BASE_MS = 400;

function esTransitorio(mensaje: string): boolean {
  const plano = mensaje.toLowerCase();
  return PATRONES_TRANSITORIOS.some((p) => plano.includes(p));
}

export async function conReintentos<T>(descripcion: string, operacion: () => Promise<T>): Promise<T> {
  let ultimo: unknown;

  for (let intento = 0; intento <= REINTENTOS; intento += 1) {
    try {
      return await operacion();
    } catch (e) {
      ultimo = e;
      const mensaje = e instanceof Error ? e.message : String(e);
      if (!esTransitorio(mensaje) || intento === REINTENTOS) break;
      await new Promise((r) => setTimeout(r, ESPERA_BASE_MS * 2 ** intento));
    }
  }

  const mensaje = ultimo instanceof Error ? ultimo.message : String(ultimo);
  throw new Error(`${descripcion}: ${mensaje}`);
}
