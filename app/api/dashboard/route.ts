import { NextResponse } from "next/server";

import { obtenerResumenDashboard } from "@/lib/dashboard/servicio";

export const dynamic = "force-dynamic";

/**
 * Resumen completo del dashboard. El shape es `ResumenDashboard` de
 * lib/dashboard/types.ts y está documentado en docs/dashboard-contrato.md.
 */
export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await obtenerResumenDashboard() });
  } catch (e: unknown) {
    console.error("[api/dashboard]", e);
    const message = "Error interno";
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message } }, { status: 500 });
  }
}
