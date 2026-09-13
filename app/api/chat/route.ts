import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  continuarConversacion,
  ErrorSesion,
  iniciarConversacion,
} from "@/lib/agent/sesion";

/**
 * El canal de texto: un envoltorio HTTP delgado sobre `lib/agent/sesion.ts`.
 *
 * La lógica de conversación NO vive acá a propósito. El orquestador de voz va a
 * llamar a las mismas dos funciones con `canal: "voz"`, y así los dos canales
 * comparten señal de riesgo, reglas, validador y tablas sin duplicar nada
 * (contrato de `voice/README.md`).
 *
 * Lo que esta respuesta NUNCA lleva: la señal de riesgo. Es interna — queda guardada
 * con la conversación para el dashboard, pero no cruza hacia el cliente.
 */

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
      const inicio = await iniciarConversacion({
        slug: parsed.data.slug,
        apertura: parsed.data.apertura,
        canal: "texto",
      });

      return NextResponse.json({
        success: true,
        data: {
          conversacionId: inicio.conversacionId,
          cliente: { nombre: inicio.cliente.nombre },
          turnos: inicio.turnos,
          ...(inicio.turno
            ? {
                metricas: {
                  latenciaMs: inicio.turno.latenciaMs,
                  tokensIn: inicio.turno.tokensIn,
                  tokensOut: inicio.turno.tokensOut,
                  validadorOk: inicio.turno.validadorOk,
                },
              }
            : {}),
        },
      });
    }

    const respuesta = await continuarConversacion({
      conversacionId: parsed.data.conversacionId,
      texto: parsed.data.texto,
    });

    return NextResponse.json({
      success: true,
      data: {
        conversacionId: respuesta.conversacionId,
        turnos: [{ rol: "agente", texto: respuesta.turno.texto }],
        cerrada: respuesta.cerrada,
        tipoCierre: respuesta.tipoCierre,
        metricas: {
          latenciaMs: respuesta.turno.latenciaMs,
          tokensIn: respuesta.turno.tokensIn,
          tokensOut: respuesta.turno.tokensOut,
          validadorOk: respuesta.turno.validadorOk,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof ErrorSesion) return error(e.codigo, e.message, e.estadoHttp);
    const mensaje = e instanceof Error ? e.message : "Error interno";
    return error("SERVER_ERROR", mensaje, 500);
  }
}
