# Selección del modelo de LLM — decisión compartida

> **Copia intencionalmente redundante.** Este contenido también vive en
> `voice/pipeline/docs/model-selection.md` porque el LLM lo usa tanto el canal de
> texto (el que más pesa en la rúbrica) como los dos enfoques de voz. Si esta
> decisión cambia, actualizar **ambos** archivos — no es un link, es una copia a
> propósito para que quien trabaje en `lib/agent/` no tenga que ir a buscarla dentro
> de `voice/`.

## Criterios (en orden de peso real para este reto)

1. Calidad conversacional en español salvadoreño, voseo natural — **20 pts**
2. Tool-calling estricto: los argumentos de `consultarCliente`, `consultarOpcionesValidas`,
   `registrarAcuerdo` tienen que validar 100 % contra el schema — sostiene "efectividad
   de la gestión" (**20 pts**)
3. Robustez ante los 20 ataques que el jurado anunció que va a intentar en vivo
   (`01-reglas-del-agente.md` §4)
4. Costo por token, transparente y cacheable — alimenta el dashboard ("budget de
   tokens en tiempo real", ver `02-decisiones-y-plan.md` §Dashboard)

## Comparación paga (si el banco financia el demo)

| | **Claude Opus 5 / Sonnet 5** | **GPT-5.5** | **Gemini 3 Pro** |
|---|---|---|---|
| Precio /1M tok (in/out) | Opus 5: $5/$25 · Sonnet 5: $2/$10 | ~$5/$30 | ~$2/$12 |
| Tool-calling estricto | `strict: true` — garantiza JSON válido contra schema | Structured Outputs con `strict: true`, igual de maduro | Soportado, históricamente menos determinista |
| Prompt caching | Sí, TTL configurable — clave porque el system prompt + reglas + escalera se reenvía cada turno | Sí | Sí, con más fricción de setup |

**Recomendación paga: Claude Opus 5.** El diferencial de costo frente a Sonnet 5 es de
centavos en un demo de ~20 corridas; la variable que importa es robustez de
instrucción frente a la batería de ataques del jurado, no precio. Sonnet 5 es la
alternativa razonable si se prioriza recortar costo sobre margen de seguridad.

## Cadena de fallback a costo cero

En este orden — **self-hosted es la última opción, no la primera** (mismo criterio
usado en `voice/pipeline/docs/model-selection.md`):

| Prioridad | Opción | Costo | Por qué en este orden |
|---|---|---|---|
| **1** | **Gemini Flash / Flash-Lite (Google AI Studio)** | $0 permanente, sin tarjeta | Tier gratuito real de un modelo de frontera. Anotar: los datos del tier gratis pueden usarse para entrenamiento de Google — no es problema con el dataset de juguete del reto. |
| **2** | **Groq (Llama 3.3 70B u otro open-weight)** | $0 permanente | Respaldo si Gemini se queda sin cupo en pleno demo. ~30 req/min, ~14,400 req/día, muy rápido. Tool-calling algo menos confiable que Gemini. |
| **3 — última opción** | **Ollama local (Llama/Mistral en la laptop)** | $0, sin límite | Solo para probar/demostrar el escenario sin red (`02-decisiones-y-plan.md`: *"probar el modo sin red temprano"*). Calidad de español y de tool-calling notablemente menor — no usar como opción principal. |

⚠️ **Correr la batería de 20 ataques sobre el modelo gratuito que efectivamente se
use.** Un modelo más chico tiene más probabilidad de filtrar jerga prohibida o de mal
formar un argumento de tool que un modelo de frontera pago.

## Resumen

| | Primaria | Respaldo | Última opción |
|---|---|---|---|
| LLM (gratis) | Gemini Flash (AI Studio) | Groq (Llama 3.3 70B) | Ollama local |
| LLM (pago, si aplica) | Claude Opus 5 | Claude Sonnet 5 | GPT-5.5 / Gemini 3 Pro |
