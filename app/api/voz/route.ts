import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { continuarConversacion, ErrorSesion, iniciarConversacion } from "@/lib/agent/sesion";

/**
 * El canal de voz, enfoque pipeline. Es el mismo envoltorio delgado que `/api/chat`,
 * con `canal: "voz"` y `modoVoz: "pipeline"`.
 *
 * Que sean dos rutas casi idénticas es el punto, no una omisión: toda la lógica de
 * conversación vive en `lib/agent/sesion.ts`, así que los dos canales comparten señal de
 * riesgo, escalera, validador y tablas sin duplicar una sola regla. Es lo que exige el
 * contrato de `voice/README.md` para que el dashboard pueda comparar los enfoques.
 *
 * El validador corre dentro de `ejecutarTurno`, o sea **antes** de que este handler
 * devuelva texto. Nada llega al TTS sin haber pasado el chequeo — esa es la garantía
 * que el análisis comparativo marca como imposible de sostener en S2S.
 *
 * Fase 1: el STT y el TTS corren en el navegador (Web Speech API), así que acá llega
 * texto ya transcrito. Cuando existan `voice/pipeline/stt.ts` y `tts.ts` esta ruta
 * sumará una rama que reciba el audio crudo; hoy no existe y no se simula.
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
  /**
   * Cuánto tardó el navegador en transcribir. Se acepta como dato medido del cliente
   * porque en Fase 1 la etapa STT ocurre allá; el servidor no puede cronometrarla.
   */
  latenciaSttMs: z.number().int().nonnegative().max(600_000).optional(),
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
        canal: "voz",
        modoVoz: "pipeline",
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
                  latenciaLlmMs: inicio.turno.latenciaMs,
                  validadorOk: inicio.turno.validadorOk,
                },
              }
            : {}),
        },
      });
    }

    const { conversacionId, texto, latenciaSttMs } = parsed.data;
    const respuesta = await continuarConversacion({ conversacionId, texto });

    return NextResponse.json({
      success: true,
      data: {
        conversacionId: respuesta.conversacionId,
        turnos: [{ rol: "agente", texto: respuesta.turno.texto }],
        cerrada: respuesta.cerrada,
        metricas: {
          // `latenciaMs` es el campo común con S2S. El desglose por etapa es el extra
          // que solo la cascada puede dar.
          latenciaMs: respuesta.turno.latenciaMs,
          latenciaSttMs: latenciaSttMs ?? null,
          latenciaLlmMs: respuesta.turno.latenciaMs,
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
