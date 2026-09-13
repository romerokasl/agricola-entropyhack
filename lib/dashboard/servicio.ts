import { z } from "zod";

import { leerDatosDashboard, leerDetalleConversacion } from "../db/dashboard";
import { calcularResumen, filaAuditoria } from "./metricas";
import type { DetalleConversacion, ResumenDashboard } from "./types";

/**
 * Punto de entrada del dashboard: lee y calcula. Lo usan la página y la API por igual,
 * así las dos siempre muestran exactamente los mismos números.
 */

export async function obtenerResumenDashboard(ahora: Date = new Date()): Promise<ResumenDashboard> {
  return calcularResumen(await leerDatosDashboard(), ahora);
}

const EsquemaId = z.string().uuid();

export function esIdConversacionValido(id: string): boolean {
  return EsquemaId.safeParse(id).success;
}

/** `null` si el id no es un UUID o la conversación no existe. */
export async function obtenerDetalleConversacion(id: string): Promise<DetalleConversacion | null> {
  // Un id que no es UUID haría fallar a Postgres con un 500; es un "no existe".
  if (!esIdConversacionValido(id)) return null;

  const datos = await leerDetalleConversacion(id);
  if (datos === null) return null;

  return {
    fila: filaAuditoria(
      datos.conversacion,
      datos.cliente ?? undefined,
      datos.turnos,
      datos.acuerdo ?? undefined,
    ),
    turnos: datos.turnos,
    acuerdoRegistrado: datos.acuerdo,
  };
}
