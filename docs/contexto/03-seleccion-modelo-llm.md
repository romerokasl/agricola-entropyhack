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
| **Acepta `temperature: 0.2`** | ❌ **No** en Opus 5 / Sonnet 5 / Opus 4.8 / 4.7 / Fable 5 — el parámetro fue eliminado y devuelve **HTTP 400**. Sí en Haiku 4.5 y Opus/Sonnet 4.6 | ✅ Sí | ✅ Sí |

**Recomendación paga: Claude Opus 5.** El diferencial de costo frente a Sonnet 5 es de
centavos en un demo de ~20 corridas; la variable que importa es robustez de
instrucción frente a la batería de ataques del jurado, no precio. Sonnet 5 es la
alternativa razonable si se prioriza recortar costo sobre margen de seguridad.

### ⚠️ Corrección importante: "temperatura 0.2" no es portable entre proveedores

El resto de los docos (`01-reglas-del-agente.md` §6, `02-decisiones-y-plan.md` §4,
`00-contexto-global.md` §7) fijan **`temperature: 0.2`** como configuración y lo usan
como respuesta pública en el Q&A sobre control de alucinaciones. Eso **no se puede
cumplir literalmente con Claude Opus 5 ni Sonnet 5**: esos modelos ya no exponen
`temperature` y rechazan la petición con 400. Las dos afirmaciones no pueden ser ciertas
a la vez.

Cómo queda resuelto:

- **No afecta la implementación actual.** El primario decidido es **Gemini Flash**, que
  sí acepta `temperature: 0.2`. Se implementa tal cual y la recomendación de Alejandro
  se cumple al pie de la letra.
- **Si en algún momento se pasa a Claude** y se quiere mantener el 0.2 literal, el
  modelo tiene que ser **Haiku 4.5** u **Opus/Sonnet 4.6**. Con Opus 5 / Sonnet 5 el
  control equivalente es `effort` bajo, no `temperature`.
- **Reformular la respuesta del Q&A** para que no sea frágil al proveedor:
  > *"Usamos la temperatura mínima donde el proveedor la expone — 0.2 en Gemini. En los
  > modelos que ya no exponen temperatura, el control equivalente es esfuerzo bajo. En
  > los dos casos la garantía dura no es el sampling: es el validador determinista que
  > corre en cada turno."*

Esa última frase además es una respuesta **mejor** que la original, porque el sampling
nunca fue la garantía real — el validador sí.

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

## 🚨 La cuota del tier gratuito es el mayor riesgo operativo del demo

**Medido contra la API el 12 de septiembre**, no estimado:

```
GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20
```

**Veinte peticiones por día y por modelo.** Una conversación completa de Karla consume
entre 4 y 6 (apertura + turnos + ida y vuelta de herramientas + reintentos del
validador). Es decir: **~3 conversaciones diarias por modelo**, cuando el propio plan
del equipo dice que el demo "se va a correr veinte veces".

Cómo está mitigado hoy, en `lib/agent/llm.ts`:

- **La cuota es por modelo, así que el proveedor rota entre varios** (`gemini-3.6-flash`
  → `3.7` → `3.8` → `3.5` → `3.1-flash-lite`). Cuando uno devuelve 429, pasa al
  siguiente automáticamente. Eso multiplica la capacidad por cinco sin pagar nada.
- `GEMINI_MODEL` fija uno solo y desactiva la rotación, para pruebas controladas.
- Cada turno registra en `turnos.modelo_version` **cuál modelo lo atendió de verdad**,
  no cuál se pretendía usar.

Qué queda pendiente y hay que decidir antes del pitch:

1. **Ensayar con cuidado.** Cada ensayo completo quema cuota real. Conviene ensayar el
   guion sin disparar el agente y reservar las corridas completas.
2. **Tener una segunda API key** (otra cuenta de AI Studio) como respaldo: duplica la
   cuota de inmediato y es gratis.
3. **Implementar el fallback a Groq**, que ya estaba decidido. Deja de ser opcional:
   es el seguro contra quedarse sin cuota en vivo.

## Resumen

| | Primaria | Respaldo | Última opción |
|---|---|---|---|
| LLM (gratis) | Gemini Flash (AI Studio) | Groq (Llama 3.3 70B) | Ollama local |
| LLM (pago, si aplica) | Claude Opus 5 | Claude Sonnet 5 | GPT-5.5 / Gemini 3 Pro |
