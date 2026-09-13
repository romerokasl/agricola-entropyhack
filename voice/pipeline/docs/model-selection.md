# Selección de modelos — costo cero, con cadena de fallback

> Aplica al enfoque **pipeline (STT→LLM→validador→TTS)**. La sección de LLM también
> vive de forma redundante en `docs/contexto/03-seleccion-modelo-llm.md` porque el
> LLM es compartido con el canal de texto — no la dupliques en más lugares, actualiza
> ambas copias si cambia.

## Regla de prioridad (para las 3 etapas)

En este orden, **sin saltarse pasos**:

1. **Tier gratuito de un proveedor hospedado**, sin tarjeta — es la opción más rápida
   de integrar y la más parecida a lo que se usaría en producción.
2. **Crédito de prueba gratuito de un proveedor hospedado** — mismo nivel de calidad
   que la opción paga, financiado con crédito promocional.
3. **Self-hosted / local — última opción, no la primera.** Se usa únicamente como
   red de seguridad para el modo sin red (`02-decisiones-y-plan.md`: *"probar el modo
   sin red temprano, no a las 3 a.m."*). No se monta por defecto: se monta cuando 1 y
   2 fallan o cuando se prueba explícitamente el escenario offline.

Motivo de este orden: correr algo local reduce la calidad conversacional y de voz
(criterio de 20 puntos) y consume tiempo de setup que en un hackatón no sobra. Los
tiers gratuitos y créditos de prueba dan la misma calidad que la opción paga sin
gastar nada — hay que agotar esas opciones antes de bajar a local.

---

## 1. LLM (compartido con el canal de texto)

### Referencia — comparación paga (por si el banco financia el demo)

| | Claude Opus 5 / Sonnet 5 | GPT-5.5 | Gemini 3 Pro |
|---|---|---|---|
| Precio /1M tok | Opus 5 $5/$25 · Sonnet 5 $2/$10 | ~$5/$30 | ~$2/$12 |
| Tool-calling estricto | `strict: true`, el más maduro | Structured Outputs, igual de maduro | Soportado, menos determinista |
| Recomendado | ✅ Opus 5 (robustez ante ataques del jurado) | Alternativa válida | Más barato, menos garantías de schema |

### Cadena de fallback a costo cero

| Prioridad | Opción | Costo | Por qué en este orden |
|---|---|---|---|
| **1** | **Gemini Flash / Flash-Lite (Google AI Studio)** | $0 permanente, sin tarjeta | Tier gratuito real de un modelo de frontera, sin necesidad de crédito ni tarjeta. Riesgo a anotar: los datos del tier gratis pueden usarse para entrenamiento de Google — no es problema con el dataset de juguete, pero no meter datos reales ahí. |
| **2** | **Groq (Llama 3.3 70B u otro open-weight)** | $0 permanente | Respaldo si Gemini se queda sin cupo en pleno demo. 30 req/min, ~14,400 req/día, muy rápido (~320 tok/s). Tool-calling algo menos confiable que Gemini. |
| **3 — última opción** | **Ollama local (Llama/Mistral en la laptop)** | $0, sin límite | Solo como fallback sin red. Calidad de español y de tool-calling notablemente menor — no usar como opción principal del demo, solo para probar el escenario "sin internet". |

⚠️ **Correr la batería de 20 ataques (`01-reglas-del-agente.md` §4) sobre el modelo
gratuito que efectivamente se use.** Un modelo más chico tiene más probabilidad de
filtrar jerga prohibida o de mal formar un argumento de tool que Opus 5.

---

## 2. STT (Speech-to-Text)

### Referencia — comparación paga

Deepgram Nova-3 (recomendado) vs. AssemblyAI Universal-3 Pro — ver análisis previo,
empate técnico casi total.

### Cadena de fallback a costo cero

| Prioridad | Opción | Costo | Por qué en este orden |
|---|---|---|---|
| **1** | **Deepgram (crédito de prueba $200)** | $0 hasta agotar el crédito, no expira en 1 año | Es literalmente Nova-3, la misma recomendación paga, financiada gratis — cero refactor si después el banco paga. $200 cubre de sobra todo el hackatón. |
| **2** | **Web Speech API (`SpeechRecognition` del navegador)** | $0 permanente | Cero backend, cero API key — cae directo en el frontend. Sin SLA y con precisión inconsistente (usa el backend de Google detrás de cámara, y sigue necesitando internet). Úsalo si el crédito de Deepgram se agota o para una prueba rápida sin configurar nada. |
| **3 — última opción** | **Whisper self-hosted (`small`/`base`, local)** | $0, sin límite | Solo para el escenario sin red. Buena calidad multilingüe (99 idiomas, incluye español), pero sin GPU la latencia sube — medirla antes de confiar en ella para una demo en vivo. |

---

## 3. TTS (Text-to-Speech)

### Referencia — comparación paga

ElevenLabs Flash v2.5 (recomendado por naturalidad en español) vs. Cartesia Sonic-3
(si se prioriza latencia pura) — ver análisis previo.

### Cadena de fallback a costo cero

| Prioridad | Opción | Costo | Por qué en este orden |
|---|---|---|---|
| **1** | **Google Cloud TTS, voces Neural2 (tier gratis)** | $0 permanente — 4M caracteres/mes en voces estándar + 1M WaveNet + 1M Neural2, **apilables** | Al volumen de un demo de hackatón (pocas conversaciones cortas, probadas ~20 veces) jamás se toca ese límite — es gratis sin letra chica real. Buena naturalidad en español. |
| **2** | **ElevenLabs (tier gratis)** | $0 — pero solo 10,000 caracteres/mes (~10–15 min de audio) | Es la voz más cálida/natural de todas las opciones (coincide mejor con el guardrail de tono del banco), pero la cuota es tan chica que se agota rápido si se usa para iterar. **Resérvala para grabar las tomas finales del pitch**, no para pruebas de desarrollo — para eso usa la opción 1. |
| **3 — última opción** | **Piper TTS self-hosted (voces `es_ES`/`es_MX`/`es_AR`)** | $0, sin límite, corre en CPU en tiempo real | Solo para el escenario sin red. Calidad decente y hay voces reales en español latino, pero es la opción de setup más pesado de las tres — no montarla si las opciones 1 y 2 ya cubren el demo. |

> Mención aparte: `SpeechSynthesis` del navegador (Web Speech API) también es
> $0 y funciona offline con las voces del sistema operativo, pero suena más robótico
> y arriesga el guardrail de "tono cálido, sin sonar robótico" — solo usarlo como
> último recurso de emergencia si ni Google Cloud TTS ni Piper están disponibles.

---

## Resumen — stack a costo cero para el pipeline

| Etapa | Opción 1 (primaria) | Opción 2 (respaldo hospedado) | Opción 3 — última opción (local/sin red) |
|---|---|---|---|
| LLM | Gemini Flash (AI Studio) | Groq (Llama 3.3 70B) | Ollama local |
| STT | Deepgram (crédito $200) | Web Speech API | Whisper `small` local |
| TTS | Google Cloud TTS (tier gratis) | ElevenLabs (tier gratis, solo tomas finales) | Piper local |

**Nota sobre `voice/speech-to-speech/`:** para ese enfoque, la única opción S2S nativa
con tier gratuito real es **Gemini Live (modelos Flash)** — OpenAI Realtime no tiene
tier gratuito equivalente. Es decisión del responsable de esa carpeta, se anota acá
solo como referencia cruzada.
