# Enfoque: Speech-to-Speech (audio-to-audio nativo)

Workspace de este enfoque. Ver el contrato compartido y qué NO se duplica en
[`../README.md`](../README.md) antes de escribir código acá — en particular:
mismas tools, mismo schema de datos, mismo validador aplicado siempre, y
`canal: 'voz'` + `modo_voz: 's2s'` en cada conversación para que el dashboard compare
ambos enfoques con datos reales. *(El campo `voice_mode: 'speech_to_speech'` que este
archivo nombraba antes nunca existió en el esquema: la versión vigente del contrato
está en `../README.md` y se implementa en `lib/agent/sesion.ts`.)*

## Alcance de esta carpeta

- Integración con el proveedor de audio-to-audio (ej. Realtime API, Gemini Live,
  u otro que se defina)
- Manejo del flujo bidireccional de audio (WebSockets/WebRTC)
- Definición de **dónde y cómo corre el validador determinista compartido** en un
  modelo que no pasa por texto intermedio de forma explícita — esto es lo primero
  que hay que resolver, porque es la principal objeción técnica a este enfoque
  (ver `02-decisiones-y-plan.md` §1 y `voice/pipeline/docs/critical-analysis-gemini-proposal.md`
  §2 para el argumento en contra que hay que responder con datos)
- Instrumentación de latencia round-trip (y desglose interno si el proveedor lo
  expone)

## Lo que NO va acá

Reglas de negociación, escalera de opciones, schema de datos, dashboard, canal de
texto — todo eso vive en el código global (ver contrato en `../README.md`).

## Pendiente de definir por el responsable de este enfoque

- Proveedor de audio-to-audio a usar
- Mecanismo de validación (¿transcripción paralela + corte de audio si falla?
  ¿function calling intermedio que fuerza una pausa?)
- Cómo se decide el resultado si el validador detecta una violación a mitad de
  la respuesta hablada

---

## Punto de entrada

La lógica de conversación es compartida y no se reimplementa acá: `lib/agent/sesion.ts`
expone `iniciarConversacion` / `continuarConversacion`, que ya traen la señal de riesgo,
la escalera, el validador y la persistencia. Este enfoque las llama con
`canal: "voz"` y `modoVoz: "s2s"`; lo propio de esta carpeta es el transporte de audio.

El ejemplo de uso está en [`../pipeline/README.md`](../pipeline/README.md) y el detalle
de la señal de riesgo en [`../../docs/senal-de-riesgo.md`](../../docs/senal-de-riesgo.md).

⚠️ El contrato compartido exige que **el validador determinista corra siempre**. En S2S
no hay un punto natural donde meterlo entre el modelo y el parlante: resolver eso es
parte del alcance de esta carpeta, y es el argumento que el jurado va a examinar.
