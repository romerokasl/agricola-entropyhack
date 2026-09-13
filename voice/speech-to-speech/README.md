# Enfoque: Speech-to-Speech (audio-to-audio nativo)

Workspace de este enfoque. Ver el contrato compartido y qué NO se duplica en
[`../README.md`](../README.md) antes de escribir código acá — en particular:
mismas tools, mismo schema de datos, mismo validador aplicado siempre, y el campo
`voice_mode: 'speech_to_speech'` en cada turno para que el dashboard compare ambos
enfoques con datos reales.

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
