import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { diagnosticar } from "@/lib/agent/calendario";
import { ejecutarTurno } from "@/lib/agent/orchestrator";
import type { Turno } from "@/lib/agent/types";
import { obtenerClientePorId, obtenerClientePorSlug } from "@/lib/db/clientes";
import {
  agregarTurno,
  crearConversacion,
  obtenerConversacion,
  obtenerTurnos,
} from "@/lib/db/conversaciones";

const EsquemaIniciar = z.object({
  accion: z.literal("iniciar"),
  slug: z.string().min(1),
  apertura: z.enum(["agente", "cliente"]).default("agente"),
});

const EsquemaMensaje = z.object({
  accion: z.literal("mensaje"),
  conversacionId: z.string().uuid(),
  texto: z.string().min(1).max(1000),
});

const EsquemaPeticion = z.discriminatedUnion("accion", [EsquemaIniciar, EsquemaMensaje]);

function error(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const crudo = await req.json().catch(() => ({}));
  const parsed = EsquemaPeticion.safeParse(crudo);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Petición inválida",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.accion === "iniciar") {
      const { slug, apertura } = parsed.data;

      const cliente = await obtenerClientePorSlug(slug);
      if (!cliente) return error("NOT_FOUND", `No existe el cliente "${slug}".`, 404);

      const dx = diagnosticar(cliente);

      // El caso de control vive acá: el sistema se niega a abrir una conversación
      // proactiva con alguien que no tiene por qué ser contactado. Que la persona
      // escriba primero siempre se permite — eso es soporte, no cobranza.
      if (apertura === "agente" && dx.motivo === null) {
        return error(
          "NO_CONTACTAR",
          `El sistema no abre conversación con ${cliente.nombre}: ${dx.detalle}`,
          409,
        );
      }

      const conversacion = await crearConversacion({
        clienteId: cliente.id,
        canal: "texto",
        modoVoz: null,
        apertura,
      });

      if (apertura === "cliente") {
        return NextResponse.json({
          success: true,
          data: { conversacionId: conversacion.id, cliente: { nombre: cliente.nombre }, turnos: [] },
        });
      }

      const turno = await ejecutarTurno({
        cliente,
        conversacionId: conversacion.id,
        apertura,
        historial: [],
      });

      return NextResponse.json({
        success: true,
        data: {
          conversacionId: conversacion.id,
          cliente: { nombre: cliente.nombre },
          turnos: [{ rol: "agente", texto: turno.texto }],
          metricas: {
            latenciaMs: turno.latenciaMs,
            tokensIn: turno.tokensIn,
            tokensOut: turno.tokensOut,
            validadorOk: turno.validadorOk,
          },
        },
      });
    }

    const { conversacionId, texto } = parsed.data;

    const conversacion = await obtenerConversacion(conversacionId);
    if (!conversacion) return error("NOT_FOUND", "Esa conversación no existe.", 404);
    if (conversacion.estado !== "abierta") {
      return error("CERRADA", "Esa conversación ya está cerrada.", 409);
    }

    const cliente = await obtenerClientePorId(conversacion.clienteId);
    if (!cliente) return error("NOT_FOUND", "El cliente de esa conversación no existe.", 404);

    // Se lee el historial una sola vez y se arma en memoria, en vez de releerlo
    // después de insertar: son dos viajes menos a la base por turno.
    const previos = await obtenerTurnos(conversacionId);
    await agregarTurno({ conversacionId, indice: previos.length, rol: "cliente", texto });
    const historial: Turno[] = [...previos, { rol: "cliente", texto }];

    const turno = await ejecutarTurno({
      cliente,
      conversacionId,
      apertura: conversacion.apertura,
      historial,
    });

    return NextResponse.json({
      success: true,
      data: {
        conversacionId,
        turnos: [{ rol: "agente", texto: turno.texto }],
        cerrada: turno.cerroConversacion,
        metricas: {
          latenciaMs: turno.latenciaMs,
          tokensIn: turno.tokensIn,
          tokensOut: turno.tokensOut,
          validadorOk: turno.validadorOk,
        },
      },
    });
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : "Error interno";
    return error("SERVER_ERROR", mensaje, 500);
  }
}
