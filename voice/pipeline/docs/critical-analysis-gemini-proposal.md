# Análisis crítico: propuesta de Gemini vs. contexto real del reto

> Aplica solo al enfoque **pipeline (STT→LLM→validador→TTS)** de esta carpeta.
> Contrasta una directiva técnica generada por Gemini (`gemini-code-*.md`, aportada
> por el usuario) contra `docs/contexto/00-contexto-global.md`,
> `01-reglas-del-agente.md` y `02-decisiones-y-plan.md`.

## Veredicto

Es un documento de arquitectura genérico de "buenas prácticas enterprise", no
calibrado a este reto. En varios puntos contradice decisiones que el equipo ya tomó
y ya justificó con evidencia del brief del banco — y esas decisiones eran mejores.

---

## 1. Alcance omnicanal (WhatsApp + voz + correo, todos a la vez)

> "Construir un pipeline... omnicanal (WhatsApp, llamadas telefónicas y correo)"

**Cuestionable.** El equipo decidió lo contrario explícitamente: texto es el canal
**principal**, voz es **un solo caso** de demostración, correo es solo
**"mencionarlo"** (`02-decisiones-y-plan.md` §6). El banco dijo textualmente: *"una
funcionalidad estable vale más que diez incompletas."* Construir infraestructura
real para 3 canales en las horas que quedan es el error que el banco advirtió no
cometer.

## 2. Streaming bidireccional + "modelos ligeros" para voz

> "El sintetizador de voz comience a reproducir el audio antes de que el párrafo
> completo haya sido generado" + "modelos de lenguaje ligeros... descartando
> modelos sobredimensionados"

Dos problemas:

- **Conflicto de seguridad no resuelto.** Si el TTS empieza a hablar antes de que
  el LLM termine, no hay dónde correr el validador determinista (bancos
  prohibidos, palabras prohibidas, monto verificado) antes de que el cliente
  escuche el audio. El equipo eligió pipeline sobre speech-to-speech
  **específicamente por esto**: *"con pipeline podés meter el validador
  determinista entre el LLM y el TTS... en speech-to-speech no hay dónde
  meterlo: si el modelo alucina, sale por el parlante"* (`02-decisiones-y-plan.md`
  §1). Streaming parcial hacia el TTS reintroduce el mismo problema por la puerta
  de atrás, justo en un contexto donde el jurado **va a intentar romper el agente
  en vivo**.
- **Premisa no sustentada.** Gemini trata los <2s como requisito duro. El banco ya
  relajó esa exigencia en vivo: *"4–5 s es manejable"* (Alejandro,
  `00-contexto-global.md` §6). Sacrificar calidad del modelo por latencia cuando
  *calidad conversacional pesa 20 puntos* y la latencia no es un criterio propio
  de la rúbrica es optimizar la variable equivocada.

**Decisión para esta carpeta:** el TTS solo se dispara con la respuesta completa y
ya validada. Nunca streaming parcial hacia el audio de salida.

## 3. Máquina de estados determinista con LLM como "traductor"

> "El LLM opera únicamente como una interfaz de traducción de lenguaje natural
> para el paso actual del proceso"

**El punto más grave del documento.** El banco dijo textualmente que su problema
actual son bots que *"tienen cierta rigidez... seguir una ruta de conversación
específica"* — y cubrir ese hueco es la tesis central del pitch. Un árbol de
decisiones/máquina de estados donde el LLM solo traduce instrucciones canónicas es
reconstruir el mismo bot rígido que el banco dijo que no le sirve.

El equipo ya lo resolvió mejor: *"autonomía en el TONO, reglas duras en la
DECISIÓN"* — el LLM controla el orden, el registro y la empatía; el código impone
límites vía tools tipadas (`consultarOpcionesValidas()`, `registrarAcuerdo()`), no
vía un guion fijo (`02-decisiones-y-plan.md` §4).

**Decisión para esta carpeta:** el LLM (compartido, vía `lib/agent/`) mantiene
control conversacional completo; esta carpeta solo envuelve su salida en audio.

## 4. Caché semántico (RAG por similitud)

> "Resolver estas consultas mediante una base de datos de similitud semántica"

Contradice una decisión ya defendida: el equipo descartó RAG/Graph-RAG para todo
el dominio de datos financieros porque *"introduce aproximaciones probabilísticas...
riesgo de alucinación en saldos o fechas, inaceptable bajo la regulación de la
SSF"* (`02-decisiones-y-plan.md` §1). Un caché semántico para FAQs tiene el mismo
riesgo estructural: un falso positivo de similitud puede devolver un monto,
producto o tasa incorrectos — justo lo que la regla #5 del system prompt prohíbe.
No aplica a esta carpeta (es una decisión de la capa de datos/LLM, no de audio),
pero se documenta acá porque el enfoque de voz depende de esa capa.

## 5. Micro-clasificador ML para guardrails

> "Implementar un micro-clasificador ultrarrápido"

Sobre-ingeniería frente a lo ya diseñado: lista de palabras prohibidas + regex +
verificación de montos contra el contexto del cliente
(`01-reglas-del-agente.md` §5) — cero costo de inferencia, determinista, sin
dataset de entrenamiento. Meter otro modelo agrega latencia y una nueva fuente de
falsos negativos sin ganancia clara. El validador es compartido (`lib/`); esta
carpeta solo lo invoca antes de sintetizar audio.

## 6. Triaje de canal con ML clásico

> "Utilizar modelos de clasificación tradicionales... para predecir el canal
> óptimo de contacto basándose en el comportamiento histórico"

No sustentado con los datos disponibles: el dataset es sintético (~2,000 clientes
de juguete). No hay comportamiento histórico real para entrenar ni validar este
clasificador, y el enrutamiento de canal no es parte de ningún criterio de la
rúbrica. Fuera de alcance también de esta carpeta.

---

## Lo que sí es correcto y se adopta

- **Orquestador central + memoria unificada en BD** — coincide con el diseño del
  equipo, acotado a los canales que realmente se construyen (texto + este caso de
  voz), no a "omnicanalidad" plena.
- **Capa de guardrails antes de enviar la respuesta** — el principio es correcto;
  se implementa como reglas deterministas compartidas, no como clasificador ML.

## Implicación directa para esta carpeta (`voice/pipeline/`)

1. STT transcribe → se envía como texto al LLM compartido (mismas tools, mismo
   prompt que usa el canal de texto).
2. La respuesta completa del LLM pasa por el validador determinista compartido.
3. Solo si pasa, se sintetiza audio con TTS. Si falla, se reintenta una vez o cae a
   una respuesta segura predefinida — nunca se sintetiza una respuesta no validada.
4. Se registra `latencia_ms` desglosada por etapa (STT/LLM/validador/TTS) y
   `voice_mode: 'pipeline'` en cada turno, para que el dashboard compare esto
   contra el enfoque speech-to-speech con datos reales, no con argumentos.
