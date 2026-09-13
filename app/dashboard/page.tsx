import type { Metadata } from "next";

import { DashboardVista } from "@/components/dashboard/DashboardVista";
import { obtenerResumenDashboard } from "@/lib/dashboard/servicio";
import type { ResumenDashboard } from "@/lib/dashboard/types";

import { AvisoError } from "./componentes";

/**
 * Server Component: lee Supabase y calcula el resumen en el servidor. La vista es
 * puramente presentacional y recibe el contrato ya armado.
 *
 * Para cambiar de fuente de datos solo se toca esta línea: `obtenerResumenDashboard()`
 * lee la base directo, y `pedirResumenDashboard()` de lib/dashboard/cliente.ts hace lo
 * mismo por HTTP contra GET /api/dashboard. Las dos devuelven el mismo tipo.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard · Cobranza preventiva" };

export default async function DashboardPage() {
  let resumen: ResumenDashboard;
  try {
    resumen = await obtenerResumenDashboard();
  } catch (e: unknown) {
    return <AvisoError mensaje={e instanceof Error ? e.message : "Error desconocido"} />;
  }

  return <DashboardVista inicial={resumen} />;
}
