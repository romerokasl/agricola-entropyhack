import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ErrorSesion } from "@/lib/agent/sesion";
import { MOTIVOS_RECHAZO } from "@/voice/speech-to-speech/compuerta";
import {
  abrirLlamadaS2S,
  ejecutarToolS2S,
  ErrorS2S,
  registrarTurnoS2S,
} from "@/voice/speech-to-speech/servidor";

export const dynamic = "force-dynamic";

/**
 * El canal de voz, enfoque speech-to-speech (`modo_voz = 's2s'`).
 *
 * A diferencia de `/api/voz`, el audio no pasa por acá: va directo del navegador a la
 * Realtime API. Esta ruta hace las tres cosas que no pueden vivir en el navegador:
 *
 * - `iniciar` — abre la conversación (misma señal y misma decisión de contacto que los
 *   otros canales) y emite una clave efímera. La API key nunca sale del servidor.
 * - `tool` — ejecuta las herramientas compartidas contra la base.
 * - `turno` — la compuerta: valida lo que el modelo dijo antes de que suene, y persiste.
 */

const EsquemaIniciar = z.object({
  accion: z.literal("iniciar"),
  slug: z.string().min(1),
  apertura: z.enum(["agente", "cliente"]).default("agente"),
});

const EsquemaTool = z.object({
  accion: z.literal("tool"),
  conversacionId: z.string().uuid(),
  nombre: z.string().min(1).max(100),
  argumentos: z.string().max(10_000),
});

const EsquemaTurno = z.object({
  accion: z.literal("turno"),
  conversacionId: z.string().uuid(),
  textoCliente: z.string().min(1).max(2_000).nullable(),
  // Puede llegar vacío: el validador lo rechaza como "vacia" en vez de un 400.
  textoAgente: z.string().max(4_000),
  completa: z.boolean(),
  intento: z.union([z.literal(1), z.literal(2)]),
  motivoPrevio: z.enum(MOTIVOS_RECHAZO).nullable(),
  metricas: z.object({
    latenciaMs: z.number().int().nonnegative().max(600_000),
    tokensIn: z.number().int().nonnegative().nullable(),
    tokensOut: z.number().int().nonnegative().nullable(),
  }),
});

const EsquemaPeticion = z.discriminatedUnion("accion", [EsquemaIniciar, EsquemaTool, EsquemaTurno]);

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
        error: { code: "VALIDATION_ERROR", message: "Petición inválida", details: parsed.error.flatten() },
      },
      { status: 400 },
    );
  }

  try {
    const peticion = parsed.data;

    if (peticion.accion === "iniciar") {
      const llamada = await abrirLlamadaS2S({ slug: peticion.slug, apertura: peticion.apertura });
      return NextResponse.json({ success: true, data: llamada });
    }

    if (peticion.accion === "tool") {
      const resultado = await ejecutarToolS2S({
        conversacionId: peticion.conversacionId,
        nombre: peticion.nombre,
        argumentos: peticion.argumentos,
      });
      return NextResponse.json({ success: true, data: resultado });
    }

    const resultado = await registrarTurnoS2S({
      conversacionId: peticion.conversacionId,
      textoCliente: peticion.textoCliente,
      textoAgente: peticion.textoAgente,
      completa: peticion.completa,
      intento: peticion.intento,
      motivoPrevio: peticion.motivoPrevio,
      metricas: peticion.metricas,
    });
    return NextResponse.json({ success: true, data: resultado });
  } catch (e: unknown) {
    if (e instanceof ErrorSesion) return error(e.codigo, e.message, e.estadoHttp);
    if (e instanceof ErrorS2S) return error(e.codigo, e.message, e.estadoHttp);
    console.error("[api/voz-s2s]", e);
    return error("SERVER_ERROR", "Error interno", 500);
  }
}
