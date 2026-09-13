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

## Estructura sugerida (a medida que se implemente)

```
pipeline/
├── README.md
├── docs/
│   └── critical-analysis-gemini-proposal.md
├── stt.ts / stt.py           (adaptador del proveedor de STT)
├── tts.ts / tts.py           (adaptador del proveedor de TTS)
└── orchestrator.ts / .py     (STT → LLM (tools compartidas) → validador → TTS)
```
