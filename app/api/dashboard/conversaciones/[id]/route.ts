import { NextResponse } from "next/server";

import { esIdConversacionValido, obtenerDetalleConversacion } from "@/lib/dashboard/servicio";

export const dynamic = "force-dynamic";

function error(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/** Transcripción y registro de una conversación. Shape: `DetalleConversacion`. */
export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const params = await Promise.resolve(context.params);
  if (!esIdConversacionValido(params.id)) {
    return error("VALIDATION_ERROR", "El id de conversación tiene que ser un UUID.", 400);
  }

  try {
    const detalle = await obtenerDetalleConversacion(params.id);
    if (detalle === null) return error("NOT_FOUND", "Esa conversación no existe.", 404);
    return NextResponse.json({ success: true, data: detalle });
  } catch (e: unknown) {
    console.error("[api/dashboard/conversaciones]", e);
    return error("SERVER_ERROR", "Error interno", 500);
  }
}
