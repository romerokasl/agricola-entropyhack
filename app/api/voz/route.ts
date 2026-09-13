import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { continuarConversacion, ErrorSesion, iniciarConversacion } from "@/lib/agent/sesion";
import { registrarLatenciaTts } from "@/lib/db/conversaciones";
import { normalizarParaVoz } from "@/voice/pipeline/normalizador";
import { obtenerSttProvider } from "@/voice/pipeline/stt";
import { obtenerTtsProvider } from "@/voice/pipeline/tts";

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

/**
 * Turno hablado: llega el audio crudo y lo transcribe el servidor. Es la diferencia que
 * le importa al jurado — con esta rama la transcripción es evidencia producida acá, no
 * algo que afirmó el cliente.
 */
const EsquemaAudio = z.object({
  accion: z.literal("audio"),
  conversacionId: z.string().uuid(),
  /** WAV PCM 16 bits mono 16 kHz, en base64. */
  audioBase64: z.string().min(1).max(20_000_000),
});

const EsquemaPeticion = z.discriminatedUnion("accion", [
  EsquemaIniciar,
  EsquemaMensaje,
  EsquemaAudio,
]);

function error(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * Lo que se pronuncia. `turnos` lleva el texto escrito — que es lo que se persiste y lo
 * que el jurado lee como transcripción — y `hablado` la versión fonética.
 * Corre después del validador: no puede cambiar contenido, solo cómo se lee.
 */
function paraHablar(turnos: readonly { rol: string; texto: string }[]): string {
  return normalizarParaVoz(
    turnos
      .filter((t) => t.rol === "agente")
      .map((t) => t.texto)
      .join(" "),
  );
}

interface AudioSintetizado {
  base64: string;
  mime: string;
  latenciaMs: number;
}

/**
 * Sintetiza en el servidor si hay proveedor configurado. `null` significa que habla el
 * navegador — o porque así está configurado, o porque el proveedor falló.
 *
 * Un fallo de TTS **no puede costar el turno del agente**: el texto ya pasó el validador
 * y ya está persistido, así que se degrada a la voz del navegador en vez de romper la
 * respuesta. Se registra en el log del servidor para no esconder el problema.
 */
async function sintetizar(hablado: string): Promise<AudioSintetizado | null> {
  const proveedor = obtenerTtsProvider();
  if (!proveedor || hablado.length === 0) return null;

  try {
    const resultado = await proveedor.sintetizar(hablado);
    return {
      base64: resultado.audio.toString("base64"),
      mime: resultado.mime,
      latenciaMs: resultado.latenciaMs,
    };
  } catch (e) {
    console.error(`[voz] TTS falló, hablará el navegador: ${e instanceof Error ? e.message : e}`);
    return null;
  }
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

      const habladoInicio = paraHablar(inicio.turnos);
      const audioInicio = await sintetizar(habladoInicio);

      if (audioInicio && inicio.turno) {
        await registrarLatenciaTts(inicio.turno.turnoId, audioInicio.latenciaMs);
      }

      return NextResponse.json({
        success: true,
        data: {
          conversacionId: inicio.conversacionId,
          cliente: { nombre: inicio.cliente.nombre },
          turnos: inicio.turnos,
          hablado: habladoInicio,
          audio: audioInicio,
          // El cliente necesita saber qué etapas corren acá: con STT de servidor manda
          // audio, sin él transcribe con la Web Speech API y manda texto.
          // Se derivan del proveedor configurado, no de si este turno produjo audio:
          // cuando abre la persona no hay turno del agente y `audioInicio` es null.
          capacidades: {
            sttEnServidor: obtenerSttProvider() !== null,
            ttsEnServidor: obtenerTtsProvider() !== null,
          },
          ...(inicio.turno
            ? {
                metricas: {
                  latenciaMs: inicio.turno.latenciaMs,
                  latenciaLlmMs: inicio.turno.latenciaLlmMs,
                  latenciaValidadorMs: inicio.turno.latenciaValidadorMs,
                  latenciaTtsMs: audioInicio?.latenciaMs ?? null,
                  validadorOk: inicio.turno.validadorOk,
                },
              }
            : {}),
        },
      });
    }

    // Los dos caminos convergen acá: lo único que cambia es de dónde salió el texto.
    let texto: string;
    let latenciaSttMs: number | null;

    if (parsed.data.accion === "audio") {
      const proveedor = obtenerSttProvider();
      if (!proveedor) {
        return error(
          "STT_NO_CONFIGURADO",
          'Llegó audio pero STT_PROVIDER es "navegador". Mandá texto o configurá "whisper".',
          400,
        );
      }
      const transcripcion = await proveedor.transcribir(
        Buffer.from(parsed.data.audioBase64, "base64"),
      );
      if (transcripcion.texto.length === 0) {
        return error("SIN_VOZ", "No se entendió nada en el audio.", 422);
      }
      texto = transcripcion.texto;
      latenciaSttMs = transcripcion.latenciaMs;
    } else {
      texto = parsed.data.texto;
      latenciaSttMs = parsed.data.latenciaSttMs ?? null;
    }

    const { conversacionId } = parsed.data;
    const respuesta = await continuarConversacion({ conversacionId, texto, latenciaSttMs });

    const hablado = normalizarParaVoz(respuesta.turno.texto);
    const audio = await sintetizar(hablado);

    // El turno ya está persistido: su latencia de TTS se completa acá porque la síntesis
    // ocurre después de que el texto es transcripción.
    if (audio) await registrarLatenciaTts(respuesta.turno.turnoId, audio.latenciaMs);

    return NextResponse.json({
      success: true,
      data: {
        conversacionId: respuesta.conversacionId,
        // Lo que se transcribió, para que la persona vea en pantalla lo que el sistema
        // entendió. Si el STT se equivoca, se nota — no se esconde.
        transcripcion: texto,
        turnos: [{ rol: "agente", texto: respuesta.turno.texto }],
        hablado,
        audio,
        cerrada: respuesta.cerrada,
        tipoCierre: respuesta.tipoCierre,
        metricas: {
          // `latenciaMs` es el campo común con S2S. El desglose por etapa es el extra
          // que solo la cascada puede dar.
          latenciaMs: respuesta.turno.latenciaMs,
          latenciaSttMs,
          latenciaLlmMs: respuesta.turno.latenciaLlmMs,
          latenciaValidadorMs: respuesta.turno.latenciaValidadorMs,
          latenciaTtsMs: audio?.latenciaMs ?? null,
          validadorOk: respuesta.turno.validadorOk,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof ErrorSesion) return error(e.codigo, e.message, e.estadoHttp);
    console.error("[api/voz]", e);
    const mensaje = "Error interno";
    return error("SERVER_ERROR", mensaje, 500);
  }
}
