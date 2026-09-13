# Enfoque: Pipeline (STT → LLM → Validador → TTS)

Workspace de este enfoque. Ver el contrato compartido y qué NO se duplica en
[`../README.md`](../README.md) antes de escribir código acá.

## Por qué este enfoque (resumen — detalle en `docs/`)

- Deja **ver y guardar la transcripción en cada paso**, que el banco pide
  explícitamente como evidencia técnica.
- Permite meter el **validador determinista entre el LLM y el TTS** — el audio
  nunca sale al cliente sin pasar el chequeo de reglas.
- El banco confirmó en vivo que **4–5 s de latencia es manejable**, así que no hace
  falta sacrificar calidad de modelo por velocidad.

Ver `docs/critical-analysis-gemini-proposal.md` para el análisis completo de por qué
se descartaron alternativas como streaming parcial hacia el TTS o modelos ligeros.

## Punto de entrada: la conversación ya existe, solo hay que ponerle audio

La lógica de conversación NO se reimplementa acá. Vive en `lib/agent/sesion.ts` y no
sabe de canales: pide la señal de riesgo, decide si el sistema tiene derecho a abrir,
corre el turno por el validador y lo persiste con `canal` y `modo_voz`.

```ts
import { iniciarConversacion, continuarConversacion } from "@/lib/agent/sesion";

const inicio = await iniciarConversacion({
  slug: "karla",
  apertura: "agente",
  canal: "voz",
  modoVoz: "pipeline",
});
// inicio.turnos[0].texto → ya pasó el validador: esto es lo que se manda al TTS

const respuesta = await continuarConversacion({
  conversacionId: inicio.conversacionId,
  texto: transcripcionDelSTT,
});
// respuesta.turno.texto → al TTS · respuesta.cerrada → colgar y cerrar
```

El prompt ya incluye una guía de redacción para voz (`GUIA_DE_VOZ` en
`lib/agent/prompt.ts`): sin listas, una sola opción por turno, y el monto y la fecha
repetidos en voz alta al cerrar. **Las reglas y las opciones válidas son idénticas a
las del canal de texto** — hay una prueba en `npm run verify:reglas` que lo verifica.

Lo que falta construir acá es únicamente el audio: STT, TTS y la instrumentación de
latencia por etapa.

## Alcance de esta carpeta

- Integración con el proveedor de STT y de TTS
- Orquestación pipeline: STT → contexto → LLM (tools compartidas) → validador → TTS
- El validador **corre siempre antes de sintetizar el audio** — nunca streaming
  parcial hacia el parlante (ver el análisis en `docs/` para el porqué)
- Instrumentación de latencia por etapa (STT / LLM / validador / TTS)
- Un solo caso de demo en voz (Karla o el que se decida), no el flujo completo

## Lo que NO va acá

Reglas de negociación, escalera de opciones, schema de datos, dashboard, canal de
texto — todo eso vive en el código global (ver contrato en `../README.md`). Esta
carpeta solo orquesta audio.

## Estructura

```
pipeline/
├── README.md
├── docs/
│   ├── critical-analysis-gemini-proposal.md
│   ├── model-selection.md
│   └── plan-implementacion.md      (orden de construcción y qué queda fuera)
├── normalizador.ts                 ✅ texto escrito → texto pronunciable
├── stt.ts                          ✅ adaptador de STT (whisper.cpp local)
├── tts.ts                          ✅ adaptador de TTS (Piper local)
└── bin/                            (gitignored — se baja con npm run voz:instalar)
```

La orquestación no vive acá: es `app/api/voz/route.ts`, un envoltorio delgado sobre
`lib/agent/sesion.ts`. El grabador del navegador (captura WAV 16 kHz sin depender de
ffmpeg) está junto a la pantalla, en `app/voz/[cliente]/grabador.ts`.

## Instalación de los motores locales

Los binarios y modelos pesan ~230 MB y no se versionan:

```bash
npm run voz:instalar
```

Baja Piper con la voz `es_MX-ald-medium` y whisper.cpp con `ggml-base.bin`. Es
idempotente. Después, en `.env.local`:

```
STT_PROVIDER=whisper    # sin esta variable, transcribe el navegador
TTS_PROVIDER=piper      # sin esta variable, habla el navegador
```

Los dos son locales: sin cuenta, sin tarjeta y sin límite de uso — el mismo criterio que
llevó a Ollama para el LLM.

### Por qué importa quién transcribe

Con `STT_PROVIDER=whisper` la transcripción la produce **el servidor**, así que vale como
evidencia técnica. Con `navegador` la produce el cliente y solo la afirma, que es más
débil frente al requisito del banco de entregar *"transcripción y resultado registrado"*.

### Latencias medidas, turno completo

| Etapa | Medido |
|---|---|
| STT (whisper `base`, 6 s de audio) | ~1.6 s |
| LLM (Gemini Flash) | ~5 s |
| TTS (Piper, 17 s de audio) | ~1.9 s |

Piper sintetiza con factor de tiempo real **0.059**. El modelo de Whisper es `base` y no
`small` a propósito: multilingüe igual, ~3× más rápido, y con `small` la etapa STT se come
el presupuesto de latencia del turno.

## El normalizador, y por qué el orden importa

```
validador → se persiste el texto ESCRITO → normalizador → TTS
```

`normalizador.ts` convierte `"$145.00"` en `"ciento cuarenta y cinco dólares"` y
`"el 16"` en `"el dieciséis"`. Importa porque el mensaje de cierre **siempre** menciona
monto y fecha, así que aparece en el turno más importante de cada conversación.

Es una ventaja estructural sobre speech-to-speech, no un detalle cosmético: existe un
paso de texto intermedio donde intervenir antes de sintetizar, que un modelo
audio-to-audio no tiene. La transcripción que queda en `turnos` y que ve el jurado es la
**escrita**; la hablada viaja aparte en la respuesta de la API y nunca cambia contenido
que el validador ya aprobó.
