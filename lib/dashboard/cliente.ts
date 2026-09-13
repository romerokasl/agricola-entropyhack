import type { DetalleConversacion, ResumenDashboard } from "./types";

/**
 * Cliente tipado de la API del dashboard.
 *
 * Es el camino para consumir los datos desde un Client Component o desde fuera de
 * Next. Dentro de un Server Component conviene `obtenerResumenDashboard()` de
 * `servicio.ts`: evita el viaje HTTP y lee Supabase directo.
 *
 * Las dos rutas devuelven exactamente el mismo `ResumenDashboard`, así que cambiar
 * de una a otra no toca ningún componente.
 */

interface RespuestaOk<T> {
  success: true;
  data: T;
}

interface RespuestaError {
  success: false;
  error: { code: string; message: string };
}

export class ErrorDashboard extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErrorDashboard";
  }
}

async function pedir<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });

  let cuerpo: RespuestaOk<T> | RespuestaError;
  try {
    cuerpo = (await res.json()) as RespuestaOk<T> | RespuestaError;
  } catch {
    throw new ErrorDashboard(
      `La respuesta de ${url} no es JSON válido.`,
      "SERVER_ERROR",
      res.status,
    );
  }

  if (!cuerpo.success) {
    throw new ErrorDashboard(cuerpo.error.message, cuerpo.error.code, res.status);
  }

  return cuerpo.data;
}

/** `GET /api/dashboard` */
export function pedirResumenDashboard(signal?: AbortSignal): Promise<ResumenDashboard> {
  return pedir<ResumenDashboard>("/api/dashboard", signal);
}

/** `GET /api/dashboard/conversaciones/[id]` */
export function pedirDetalleConversacion(
  id: string,
  signal?: AbortSignal,
): Promise<DetalleConversacion> {
  return pedir<DetalleConversacion>(
    `/api/dashboard/conversaciones/${encodeURIComponent(id)}`,
    signal,
  );
}
