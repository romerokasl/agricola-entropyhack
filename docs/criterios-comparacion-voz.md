# Guía de Investigación y Criterios de Comparación: Arquitectura de Voz
## Reto Bancoagrícola · Cobranza Preventiva Empática (EntropyHack 2026)

> **Documento de trabajo para el equipo de desarrollo e investigación.**
> Este marco de evaluación define los aspectos técnicos, regulatorios y económicos exactos que deben investigarse y medirse para decidir la arquitectura de voz del agente.
> **No contiene conclusiones preconcebidas**: cada responsable debe recopilar datos duros, benchmarks y evidencias técnicas en la plantilla provista para sustentar la decisión final.

---

## 1. Sujetos de Estudio

Debemos evaluar de forma rigurosa y objetiva dos arquitecturas técnicas para la atención telefónica:

* **Opción A — Pipeline Modular en Cascada (STT → LLM → TTS):**
  * *Entrada:* Audio del usuario transmitido por streaming.
  * *Paso 1 (STT):* Transcripción de voz a texto (ej. Deepgram Nova-2, Whisper API / Whisper-large-v3, AssemblyAI).
  * *Paso 2 (LLM + Guardrails):* Procesamiento del mensaje, llamada a herramientas bancarias y generación de respuesta textual con validador determinista intermedio (ej. GPT-4o-mini, Claude 3.5 Haiku, Llama 3.3 vía Groq).
  * *Paso 3 (TTS):* Síntesis de voz a partir del texto validado (ej. Cartesia Sonic, ElevenLabs Turbo v2, OpenAI TTS).
  * *Salida:* Audio reproducido al cliente.

* **Opción B — Modelo Speech-to-Speech Nativo (S2S / Audio-to-Audio):**
  * *Entrada:* Flujo continuo bidireccional de audio (WebSockets / WebRTC).
  * *Procesamiento:* Modelo multimodal omni que procesa audio directamente y genera audio de salida sin pasar explícitamente por representaciones de texto intermedias (ej. OpenAI Realtime API con `gpt-4o-realtime-preview`, Gemini 2.0 Flash / Live Multimodal, Kyutai Moshi, Mini-Omni).
  * *Salida:* Audio sintetizado directamente desde los pesos del modelo.

---

## 2. Dimensiones y Métricas Específicas de Evaluación

Para cada una de las 6 dimensiones, el equipo asignado debe investigar y documentar datos cuantitativos (cifras verificables) y cualitativos (capacidades operativas).

### Dimensión 1: Latencia y Dinámica Conversacional en Tiempo Real
El objetivo del banco es que la llamada no se sienta como un menú telefónico ni presente silencios incómodos.

1. **TTFB (Time To First Audio Byte) [milisegundos]:**
   * *Definición:* Tiempo transcurrido desde que el usuario deja de hablar hasta que se emite el primer fragmento audible de respuesta.
   * *Pregunta a investigar:* ¿Cuál es el rango de latencia medido en condiciones normales de red?
2. **Latencia de Turno Completo (Round-Trip Turn-Around Time) [milisegundos]:**
   * *Definición:* Tiempo total de procesamiento y recepción de la réplica completa.
   * *Pregunta a investigar:* ¿Se mantiene de forma consistente por debajo de los 2,000 ms exigidos para telefonía?
3. **VAD (Voice Activity Detection) y Detección de Fin de Frase (End-of-Utterance - EOU):**
   * *Definición:* Capacidad de distinguir entre una pausa para respirar/pensar y el verdadero final del turno del usuario.
   * *Pregunta a investigar:* ¿El sistema permite ajustar el umbral de silencio (p. ej. 500ms vs 800ms) para evitar cortar al cliente cuando titubea por estrés financiero?
4. **Latencia y Manejo de Interrupción (Barge-in):**
   * *Definición:* Tiempo que tarda el sistema en callarse inmediatamente cuando el usuario empieza a hablar mientras el bot está reproduciendo audio.
   * *Pregunta a investigar:* ¿Cómo se descarta el audio residual en cola? ¿Se producen ecos o desincronizaciones?
5. **Comportamiento ante Jitter y Paquetes Tardíos:**
   * *Pregunta a investigar:* ¿Cómo se comporta el protocolo de audio (WebSockets vs WebRTC) cuando la conexión móvil del usuario tiene pérdida de paquetes o latencia variable?

---

### Dimensión 2: Control, Guardrails y Cumplimiento Normativo Bancario
El banco y la Superintendencia del Sistema Financiero (SSF) exigen que el agente respete estrictamente los límites de negociación y no prometa nada ilegal o inexistente.

1. **Factibilidad de Intercepción Inter-Turno (Middleware Determinista):**
   * *Definición:* Capacidad de inspeccionar la respuesta generada por el modelo con código determinista (regex, listas de exclusión, validación de condiciones lógicas) **antes** de que el audio suene en el parlante del cliente.
   * *Pregunta a investigar:* ¿Existe un punto del pipeline donde se pueda bloquear físicamente una alucinación antes de que llegue al usuario? ¿Es viable en la Opción A? ¿Cómo se logra en la Opción B?
2. **Tasa de Fuga de Guardrails Financieros (Hallucination Containment):**
   * *Pregunta a investigar:* Bajo ataques de prompt injection o presión del usuario (*"dame 2 años de plazo"*, *"condoname los intereses"*, *"ofreceme un crédito de Banco Cuscatlán"*), ¿cuál arquitectura ofrece mayor garantía de contención?
3. **Anonimización y Enmascaramiento de PII en Vuelo:**
   * *Pregunta a investigar:* Si el usuario menciona su número de cuenta, saldo o documento (DUI), ¿cómo se detecta y enmascara antes de enviarse a proveedores externos o guardarse en logs?
4. **Vulnerabilidad a Modulaciones y Ataques Vocales:**
   * *Pregunta a investigar:* ¿El modelo puede ser manipulado mediante entonaciones específicas, susurros o comandos acústicos que burlen los prompts del sistema?

---

### Dimensión 3: Trazabilidad, Observabilidad y Persistencia de Auditoría
El brief oficial del banco exige explícitamente: *"Demostración estable, repositorio, transcripción y resultado registrado en base de datos"*.

1. **Generación de Transcripción Literal Oficial (Ground Truth Text):**
   * *Pregunta a investigar:* ¿La arquitectura produce de forma nativa e inmediata el texto exacto de lo dicho por el cliente y lo respondido por el agente, o requiere correr procesos adicionales de transcripción post-llamada?
2. **Estabilidad y Latencia de Function Calling (Tool Use):**
   * *Pregunta a investigar:* Durante la llamada, el agente debe invocar herramientas (`consultarCliente`, `consultarOpcionesValidas`, `registrarAcuerdo`). ¿Cómo maneja cada opción la invocación de herramientas en paralelo con la generación de voz? ¿Hay pausas audibles o desconexiones?
3. **Extracción Estructurada de Datos del Acuerdo:**
   * *Pregunta a investigar:* Al cerrar la negociación, ¿con qué nivel de certeza se extraen los campos tipados (`monto_acordado`, `fecha_acordada`, `tipo_opcion`) para persistirlos en Supabase/Postgres?
4. **Granularidad de Métricas de Rendimiento (APM / Dashboard):**
   * *Pregunta a investigar:* ¿Podemos medir en el dashboard la latencia desagregada de cada componente (tiempo de audio a texto, tiempo de razonamiento, tiempo de síntesis de voz) o solo se obtiene una métrica de caja negra?

---

### Dimensión 4: Calidad Acústica, Fonética y Adaptabilidad Cultural
La evaluación otorga **20 puntos a la Calidad Conversacional y Empatía**. En El Salvador, la entonación y el dialecto son determinantes para la confianza del cliente.

1. **Fidelidad al Acento y Voseo Salvadoreño:**
   * *Pregunta a investigar:* ¿Qué tan natural suena el voseo (*"podés"*, *"tenés"*, *"fijate"*)? ¿Tiende a forzar acentos neutros, mexicanos o ibéricos, o permite entonación cálida centroamericana?
2. **Pronunciación de Términos Bancarios y Formatos Locales:**
   * *Pregunta a investigar:* ¿Cómo pronuncia números de moneda (*"$125.50"*), fechas (*"el 15 y el 30"*), siglas locales (*"DUI"*, *"SSF"*, *"Bancoagrícola"*)? ¿Requiere normalizadores fonéticos previos?
3. **Modulación Emocional y Prosodia Empática:**
   * *Pregunta a investigar:* Si el cliente suena angustiado o preocupado, ¿el sistema es capaz de modular su ritmo, volumen y prosodia para sonar empático y humano sin parecer condescendiente?
4. **Calidad de Compresión en Redes de Telefonía:**
   * *Pregunta a investigar:* ¿Qué codecs soporta (Opus, PCM 16kHz, G.711 / u-law telefónico) y cómo se preserva la claridad del habla en anchos de banda reducidos?

---

### Dimensión 5: Costos Unitarios y Viabilidad Económica (Unit Economics)
El jurado evaluará si la solución es económicamente escalable para la cartera del banco.

* **Escenario Base de Cálculo:**
  * Universo: **30,000 clientes en incumplimiento temprano** por mes.
  * Duración promedio de una gestión efectiva: **3 minutos** (aproximadamente 6 turnos conversacionales).
  * Promedio de palabras/caracteres por llamada: ~400 palabras de entrada del cliente, ~300 palabras de respuesta del agente.

1. **Costo por Minuto de Llamada (USD / minuto):**
   * *Pregunta a investigar:* ¿Cuál es el desglose exacto de costos por minuto para cada proveedor evaluado?
2. **Costo Total por Conversación de 3 Minutos (USD):**
   * *Pregunta a investigar:* ¿Cuánto cuesta cerrar un acuerdo en cada arquitectura?
3. **Proyección Mensual a Escala Bancaria (USD / mes):**
   * *Pregunta a investigar:* ¿Cuál sería la factura mensual para atender a los 30,000 clientes en cada caso?
4. **Modelo de Facturación y Riesgos de Sobrecostos:**
   * *Pregunta a investigar:* ¿Se factura por segundo de audio conectado, por carácter sintetizado, por token multimodal de audio, o por sesión WebRTC activa? ¿Qué sucede con el costo en caso de silencios prolongados?

---

### Dimensión 6: Infraestructura, Integración y Soberanía Tecnológica
Bancoagrícola pertenece a Grupo Bancolombia y cuenta con una arquitectura corporativa regulada.

1. **Nivel de Dependencia del Proveedor (Vendor Lock-in):**
   * *Pregunta a investigar:* Si un proveedor de IA cambia sus políticas de precios o sufre una caída de servicio, ¿qué tan fácil es reemplazarlo sin reescribir la aplicación?
2. **Factibilidad de Despliegue Híbrido u On-Premise:**
   * *Pregunta a investigar:* ¿Existen modelos de código abierto o contenedores privados que permitan correr esta arquitectura dentro de la nube privada del banco (AWS/Azure de Bancolombia)?
3. **Compatibilidad con Infraestructura de Conmutadores Telefónicos (PBX / SIP Trunking):**
   * *Pregunta a investigar:* ¿Cómo se conecta cada arquitectura con líneas telefónicas convencionales o proveedores como Twilio, LiveKit o Asterisk?
4. **Degeneración Elegante y Fallback:**
   * *Pregunta a investigar:* Si la capa de voz falla por saturación de red en el dispositivo del cliente, ¿la sesión puede continuar de inmediato en un canal de texto sin perder el estado?

---

## 3. Plantilla de Recolección de Datos (Para completar por los investigadores)

Utilicen esta tabla para consignar los hallazgos con datos concretos y fuentes comprobables:

| Dimensión / Criterio | Métrica / Unidad | Opción A: Cascada (STT → LLM → TTS) | Opción B: S2S Nativo (Audio-to-Audio) | Fuente / Evidencia / Proveedores Probados |
|---|---|---|---|---|
| **1. Latencia** | TTFB promedio | ~200–400 ms con streaming (Deepgram Nova-3 STT ~150 ms + Groq Llama 3.3 TTFB ~100–200 ms) | **Gemini 2.5 Flash Live**: 100–200 ms · **OpenAI gpt-realtime-2.1**: ~300–500 ms · **Moshi** (self-host, GPU L4): ~160–200 ms teórico | Google Cloud docs Gemini 2.5 Flash Live; OpenAI Realtime docs; Kyutai/arXiv 2410.00037 |
| | Latencia total de turno | 700 ms–1.5 s con streaming bien encadenado; 2–4 s sin streaming (peor caso aceptado por el banco) | Gemini: ~300–500 ms · OpenAI: ~500 ms–1 s · Moshi: ~200–400 ms | mismas fuentes |
| | Precisión de VAD / Pausas | Alta (Deepgram VAD con umbral configurable 500/800 ms) | Alta en Gemini/OpenAI (VAD server-side configurable) · Moshi es full-duplex "sin turnos" — no hay EOU discreto que ajustar | docs de proveedores |
| | Tiempo de interrupción (Barge-in) | Depende de implementación propia; con diseño cuidado ~150–300 ms | Nativo en el protocolo de Gemini/OpenAI Realtime · Moshi es full-duplex por diseño (interrupción instantánea) | OpenAI/Google realtime docs; Kyutai paper |
| **2. Guardrails** | Intercepción previa a voz | **Sí, trivial** — el LLM siempre devuelve texto antes del TTS; el validador determinista corre ahí sin excepción | **No garantizado**. La propia documentación de OpenAI (LiteLLM Realtime Guardrails / Agents SDK) confirma que en el SDK de Python **"el modelo todavía dice el contenido bloqueado"** antes de que el guardrail pueda cortarlo; el bloqueo real solo existe en el SDK de Node. Gemini Live no publica un punto de intercepción pre-síntesis | docs.litellm.ai Realtime Guardrails; openai-agents-python issue #1912 |
| | Eficacia contra jailbreaks | Alta — cualquier regex/lista se aplica sobre texto plano sin ambigüedad | Depende del modelo base; sin punto de intercepción confiable, una fuga es estructural (de arquitectura), no solo de prompt | análisis propio sobre la arquitectura |
| | Sanitización de PII | Sencilla — el texto intermedio se enmascara (regex) antes de loguear o reenviar a terceros | Compleja — el DUI/cuenta puede vivir solo en tokens de audio; enmascararlo exige correr un ASR paralelo, lo que anula la ventaja de latencia de usar S2S | análisis propio |
| **3. Trazabilidad** | Transcripción de texto nativa | Nativa por diseño — es el output directo del STT | Derivada, no nativa: OpenAI y Gemini exponen "transcripts" como canal secundario. **Excepción:** Moshi genera un monólogo interno de texto sincronizado con el audio como parte de su arquitectura (Mimi codec) | OpenAI Realtime docs (transcript deltas); arXiv 2410.00037 (Moshi) |
| | Latencia de Tool Calling | Nativo, sin penalidad extra (mismo LLM call) | Soportado nativamente en OpenAI Realtime y Gemini Live (function calling en paralelo al audio) · **No soportado de forma productiva en Moshi/Mini-Omni** — exigiría ingeniería propia desde cero | docs de function calling de OpenAI/Google |
| | Extracción de datos del acuerdo | Fiable — mismo LLM que ya devuelve JSON estructurado vía tools | Fiable en OpenAI/Gemini (misma capa de function calling) · Inestable/no soportado en Moshi/Mini-Omni | igual |
| **4. Calidad** | Aceptación del voseo salvadoreño | Alta si se elige TTS con voces LatAm (ElevenLabs/Cartesia ofrecen es-419); STT multilingüe ya maduro en español | **No verificado por ningún proveedor** — ni OpenAI ni Google publican evaluación de voseo salvadoreño. Moshi/Mini-Omni están entrenados mayormente en inglés/francés — calidad en español pobre, **descalifica para este proyecto** | sin fuente verificada — riesgo declarado explícitamente |
| | Modulación prosódica empática | Depende del TTS elegido (ElevenLabs/Cartesia con buen control emocional, ya evaluado) | Teóricamente superior (un solo modelo controla prosodia end-to-end) pero sin datos verificados en español salvadoreño | — |
| | Pronunciación de montos y siglas | Controlable — normalizador de texto antes del TTS ("$125.50" → "ciento veinticinco dólares con cincuenta") | No controlable directamente — no existe un paso de texto intermedio que normalizar antes de sintetizar | — |
| **5. Costos** (30,000 clientes × 3 min/mes ≈ 90,000 min/mes) | Costo por minuto | Stack económico (Deepgram Nova-3 + Groq Llama 3.3 + TTS económico): **~$0.05–0.15/min** | **Gemini 2.5 Flash Live**: ~$0.05/min · **OpenAI gpt-realtime-2.1**: $0.06–0.11/min (variante *mini*: $0.02–0.05/min) · **Moshi self-hosted**: ~$0/min marginal, solo el costo fijo de una GPU L4 24/7 (~$0.40–0.70/h) | Deepgram pricing; OpenAI/Google pricing pages; HackerNoon "Realtime API Pricing 2026" |
| | Costo por llamada de 3 min | $0.15–$0.45 | Gemini: ~$0.15 · OpenAI flagship: ~$0.18–0.33 · OpenAI mini: ~$0.06–0.15 | cálculo propio sobre el pricing citado |
| | Costo mensual (30k llamadas) | ~$4,500–$13,500/mes | Gemini: ~$4,500/mes · OpenAI flagship: ~$5,400–$9,900/mes · OpenAI mini: ~$1,800–$4,500/mes · **Moshi: costo fijo ~$300–500/mes de GPU, independiente del volumen** | cálculo propio sobre el pricing citado |
| | Modelo de facturación | Por segundo/carácter, según el componente (fácil de auditar por etapa) | Por **token de audio**: 1 token/100ms usuario, 1 token/50ms del agente — un silencio largo del cliente sigue consumiendo tokens de entrada | OpenAI Realtime docs |
| **6. Infraestructura**| Nivel de Vendor Lock-in | **Bajo** — cada etapa (STT/LLM/TTS) es reemplazable de forma independiente sin tocar las otras | **Total** — el proveedor controla voz + razonamiento + guardrails como una sola caja negra. Excepción: Moshi (pesos abiertos, CC BY 4.0) | análisis propio |
| | Opción de self-hosting / On-prem | Sí, parcial (LLM local tipo Llama vía Ollama/Groq; STT/TTS locales: Whisper, Piper) | No en OpenAI/Gemini · **Sí en Moshi** (pero ecosistema inmaduro para producción bancaria hoy) | Kyutai GitHub (kyutai-labs/moshi) |
| | Soporte SIP / Telefonía | Maduro (Twilio, Asterisk, LiveKit se integran con cualquier STT/TTS) | Maduro solo vía integradores terceros (Twilio ↔ OpenAI Realtime) · Gemini Live más limitado en telefonía tradicional · Moshi sin soporte productivo | Twilio/OpenAI integration docs |

---

## 4. Preguntas Clave para el Veredicto Final del Equipo

Una vez completada la tabla, el equipo se reunirá para responder:

1. **¿Cuál arquitectura garantiza que una alucinación sobre condonación o plazos ilegales NUNCA suene en el teléfono del cliente?**
   **La Cascada (Opción A).** Es la única con un punto de intercepción de texto garantizado antes del audio. La evidencia decisiva: la documentación oficial de OpenAI reconoce que su propio SDK de guardrails en Python **deja pasar el audio bloqueado** antes de poder cortarlo — el bloqueo confiable solo existe en el SDK de Node, y ni así hay una garantía equivalente al "no generar el audio hasta que el texto pase el validador" que sí tiene la cascada de forma nativa.

2. **¿Cuál opción cumple de manera más directa el requisito del banco de entregar *"transcripción y resultado estructurado"*?**
   **La Cascada.** La transcripción es su output primario, no un canal derivado. Único matiz: **Moshi** es la excepción S2S — genera un monólogo interno de texto sincronizado con el audio — pero no tiene tool-calling productivo para extraer `monto_acordado`/`fecha_acordada`, así que igual perdería en el criterio de "resultado estructurado".

3. **¿La diferencia en latencia de la Opción B justifica la diferencia en costo operativo mensual y la pérdida de control determinista?**
   **No.** La ganancia de latencia de la Opción B (cientos de ms) no es perceptible frente al umbral que el propio banco aceptó (4–5 s son manejables). A cambio se pierde el punto de intercepción determinista — que es un requisito no negociable en banca regulada — y en el mejor caso (Gemini Live) el costo mensual es comparable al de la cascada, no menor.

4. **¿Cuál es la alternativa más viable para tener un prototipo estable y demostrable en el tiempo que resta del hackathon?**
   **La Cascada**, con el mismo motor conversacional (LLM + tools + validador) que ya se usa en el canal de texto. Construirla como un caso de voz reutiliza el 90 % del trabajo ya hecho en el agente; una integración S2S sería una segunda pila completa (SDK nuevo, sin validador reusable, sin tools reusables) por una ganancia marginal — riesgo alto para el tiempo que queda.

---

## 5. Veredicto: ranking de modelos Speech-to-Speech (Opción B)

Aunque el veredicto general confirma la Opción A (ver `02-decisiones-y-plan.md`, decisión #1), esta sección responde la pregunta puntual de **cuál sería el mejor modelo S2S si el equipo decidiera usar uno** — útil para defender la decisión en el Q&A ("¿evaluaron alternativas?") y por si el caso de voz del plan (`02-decisiones-y-plan.md`, orden de construcción #7) se replantea.

| # | Modelo | Veredicto | Por qué |
|---|---|---|---|
| 🥇 | **Gemini 2.5 Flash Live (native audio)** | **Mejor S2S evaluado** | Menor latencia medida (100–200 ms), tool-calling nativo, costo por minuto más bajo y predecible (~$0.05/min), 30 voces / 24 idiomas. Sigue sin evidencia de voseo salvadoreño ni de intercepción pre-síntesis. |
| 🥈 | **OpenAI gpt-realtime-2.1 (variante mini)** | Segundo lugar | Ecosistema y SDK más maduros, function calling robusto, costo competitivo en la variante mini ($0.02–0.05/min). Pierde puntos porque su propia documentación admite que el guardrail no siempre intercepta antes de hablar. |
| 🥉 | **Kyutai Moshi (self-hosted)** | Interesante para el discurso de soberanía, no para el demo | Latencia teórica más baja de las cuatro (~160–200 ms), cero costo marginal, pesos abiertos (on-prem real). **Descalificado para este hackathon**: sin tool-calling productivo, sin voces en español salvadoreño evaluadas, y montar el self-host consume horas que no sobran. Vale como respuesta de una línea a "¿y la soberanía de datos?": *"Moshi demuestra que existe un camino open-source si el banco lo pide en producción."* |
| ❌ | **Mini-Omni** | Descartado | Modelo de investigación, sin benchmarks de producción, sin soporte de español evaluado, sin comunidad de despliegue comparable a Moshi. No aporta nada que Moshi no cubra ya mejor. |

**Conclusión de esta sección:** si el banco exigiera mañana un S2S nativo, **Gemini 2.5 Flash Live** es la recomendación técnica — no OpenAI, y no por poco: gana en las tres dimensiones que más pesan para telefonía (latencia, costo, tool-calling), y su única desventaja frente a OpenAI (madurez de SDK) es un problema de tiempo de desarrollo, no de arquitectura. Pero ese hallazgo es informativo, no un cambio de plan: **la Opción A sigue siendo la arquitectura del proyecto** porque resuelve un requisito regulatorio (intercepción determinista) que ningún S2S — ni siquiera el mejor — garantiza hoy.

### Matiz importante sobre tool-calling (agregado tras revisión adicional)

La comparación inicial simplificaba de más al decir "tool-calling nativo" para ambos por igual. Investigación adicional en la documentación de LiveKit y de los propios SDKs muestra una diferencia real:

- **OpenAI Realtime**: soporta `tool_choice="none"` para forzar que la siguiente respuesta sea solo voz/texto sin más llamadas a herramientas, soporta *function calling asíncrono*, y permite actualizar el set de herramientas disponibles a mitad de sesión.
- **Gemini Live**: **no** soporta `tool_choice="none"` de forma confiable, las herramientas deben declararse en el primer `session.update` de la sesión (actualizarlas dinámicamente implica reiniciar la sesión), y en versiones recientes (3.1 Flash Live) el *function calling asíncrono no está soportado* — el modelo se queda en silencio hasta recibir la respuesta de la herramienta.

**Por qué esto no cambia la recomendación para este proyecto:** las tres herramientas que necesita el agente (`consultarCliente`, `consultarOpcionesValidas`, `registrarAcuerdo`) son consultas simples y únicas, no una cadena dinámica de herramientas — y ya está documentado en `02-decisiones-y-plan.md` que una consulta indexada a Postgres toma **< 5 ms**. La limitante de Gemini (bloquear hasta la respuesta de la herramienta) es irrelevante cuando la respuesta tarda menos de lo que dura un parpadeo. La flexibilidad extra de OpenAI (tools dinámicas, tool_choice) resuelve un problema — orquestación de múltiples herramientas cambiantes — que este agente no tiene, porque las reglas de negociación están fijas en código, no elegidas dinámicamente por el modelo.

Fuente: [Gemini realtime tool-control issue — livekit/agents #6002](https://github.com/livekit/agents/issues/6002)

## 6. Corrección: acceso a datos en tiempo real durante la sesión de voz

> **Nota de proceso:** el ranking de la sección 5 pesaba latencia y costo, pero subestimó una capacidad concreta de `gpt-realtime-2.1` que es exactamente el requisito que le importa al equipo: que el agente, mientras habla, pueda consultar datos reales (`consultarCliente`, `consultarOpcionesValidas`, `registrarAcuerdo`). Con esa capacidad puesta en el centro, el veredicto entre los dos modelos S2S cambia.

### Qué tiene gpt-realtime-2.1 que Gemini Live no tiene (verificado en fuentes técnicas, no solo comparadores)

1. **MCP remoto nativo, por URL, sin integración manual.** Se declara así en la config de la sesión:
   ```python
   "tools": [{
       "type": "mcp",
       "server_url": "https://mcp.bancoagricola-demo.com",
       "server_label": "agricola-tools",
       "allowed_tools": ["consultarCliente", "consultarOpcionesValidas", "registrarAcuerdo"],
       "headers": {"Authorization": "Bearer ..."}
   }]
   ```
   El campo `allowed_tools` es una lista blanca explícita — mismo principio de "menor privilegio" que ya exige `02-decisiones-y-plan.md`. No hay que escribir el wiring de cada tool a mano: se expone un servidor MCP delgado sobre Supabase y el modelo ya sabe llamarlo.

2. **Function calling asíncrono real.** Mientras la tool tarda (una consulta a Supabase, aunque sea de 5ms, más la ida y vuelta de red), el modelo puede decir *"Un momento, dejame confirmar eso"* y seguir sonando natural, en vez de quedarse en silencio. Gemini Live, documentado en la sección 5, **se queda callado hasta que la tool responde** — con una consulta de 5ms es imperceptible, pero con cualquier latencia de red real (100-300ms ida/vuelta a Supabase desde el servidor MCP) empieza a notarse como un corte seco.

3. **Mejora medida de precisión en tool calling: +34%** y **+48% en seguimiento de instrucciones** frente a la versión preview, según OpenAI. Es la única cifra de "calidad de tool calling" con fuente primaria del proveedor en toda esta investigación — Gemini no publica un número equivalente para su versión 2.5 Flash Live.

4. **SIP nativo hacia PSTN vía Twilio.** Si el banco algún día quiere que esto atienda líneas telefónicas reales (no solo el demo), `gpt-realtime-2.1` se conecta directo; es el canal que el banco dijo que usa "mucho" hoy.

### Veredicto revisado

Para el requisito puntual de "que además de la voz, pueda acceder a información en tiempo real", **gpt-realtime-2.1 es hoy la opción S2S técnicamente más sólida — no Gemini 2.5 Flash Live.** La combinación MCP + function calling asíncrono resuelve exactamente el problema (traer datos vivos sin romper la conversación) con menos código propio que cualquier alternativa, incluyendo construirlo a mano sobre la cascada.

**Esto NO resuelve el otro problema, que sigue siendo el motivo original de elegir la cascada:** el requisito de negocio de que una alucinación (un plazo o condonación ilegal) **nunca llegue a sonar** en el oído del cliente. MCP y function calling asíncrono son sobre *tool-calling*, no sobre *content safety* — son ejes distintos. El hallazgo de la sección 5 (el guardrail de OpenAI en el SDK de Python deja pasar el audio bloqueado) sigue vigente y no lo cambia el soporte de MCP.

**Dicho con precisión, no como eslogan:** si la prioridad fuera "acceso a datos en vivo con el mínimo trabajo de ingeniería", la respuesta correcta es `gpt-realtime-2.1`, no Gemini, y no la cascada — es el más maduro de los tres en ese eje específico. Si la prioridad es "garantizar que nunca suene una promesa ilegal", la cascada sigue ganando porque es el único con un punto de bloqueo de texto anterior al audio. Ambos requisitos están en la rúbrica del banco (Dimensión 2 y Dimensión 3 de este documento) — no son el mismo eje y no hay un modelo único que gane los dos a la vez hoy.

### Fuentes de esta sección
- [Introducing gpt-realtime and Realtime API updates — OpenAI](https://openai.com/index/introducing-gpt-realtime/)
- [OpenAI adds MCP and SIP support to gpt-realtime — InfoWorld](https://www.infoworld.com/article/4048375/openai-adds-mcp-and-sip-support-to-gpt-realtime-for-smarter-voice-based-agents.html)
- [gpt-realtime + SIP + MCP production guide — Zenn](https://zenn.dev/kai_kou/articles/191-gpt-realtime-sip-mcp-production-guide?locale=en)
- [GPT-Realtime-2.1 model page — OpenAI developers docs](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)
- [OpenAI releases gpt-realtime-2.1 — DataNorth](https://datanorth.ai/news/openai-releases-gpt-realtime-2-1-voice-models)

---

## 7. Por qué el acceso a datos en tiempo real no es un "nice to have": elegibilidad real de los productos de la escalera

> **⚠️ Aclaración de alcance (decisión del equipo):** este proyecto trabaja **únicamente con los grupos "Consumo" y "Vivienda"** de la norma NCB-022. El grupo **"Empresa" queda fuera de alcance** — usa una metodología de clasificación completamente distinta (criterios cualitativos de Anexo 3, no solo días de mora) y es "otro tipo de escalabilidad" que el equipo decidió no abordar en este hackathon. Todos los productos de la escalera de opciones (`01-reglas-del-agente.md` §2) son de Consumo, salvo que se agregue explícitamente un caso de vivienda. La transcripción completa de la norma y las reglas de cada producto de Consumo/Vivienda — la referencia que debe usar el agente para no ofrecer nada que el banco rechazaría — están en [`docs/contexto/06-ncb022-norma-completa.md`](contexto/06-ncb022-norma-completa.md).

La razón concreta por la que el modelo S2S necesita tool-calling confiable no es abstracta — es que **la mayoría de los productos de la escalera de opciones (`01-reglas-del-agente.md` §2) tienen condiciones de elegibilidad que dependen del estado exacto del cliente en ese momento**, no de un catálogo fijo. Investigación de los requisitos públicos y oficiales de cada producto real de Bancoagrícola:

| Producto (escalón) | Qué resuelve | Condición de ESTADO del cliente (bloqueante) | Parámetro numérico del que depende | Fuente |
|---|---|---|---|---|
| Recordatorio, mover fecha, abono parcial, débito automático | — | Cuenta activa | Día de pago vs. día de ingreso del cliente | interno (`FINANCIAL_BEHAVIOR`) |
| **Adelanto de Salario** | Adelanto de nómina, revolvente | **Exclusivo para clientes "planilleros"**: debe recibir su salario o pensión **directamente en Bancoagrícola**. Si no, el producto no existe para ese cliente, punto. | Asalariado: ≥6 meses continuos en la empresa + ingreso líquido ≥$136/mes · Pensionado: ≥2 meses de depósitos + ingreso ≥$74/mes · Edad ≥21 años | [bancoagricola.com/adelanto-de-salario](https://www.bancoagricola.com/adelanto-de-salario) |
| **Extrafinanciamiento** | Crédito adicional sobre el límite de la tarjeta | ⚠️ **La tarjeta asociada debe estar activa, SIN MORA ni sobregiro.** Si el cliente ya está atrasado en esa tarjeta — el caso exacto que estamos gestionando — **el producto se descalifica automáticamente.** | Edad + plazo del crédito ≤ 55–80 años según categoría laboral · ingreso ≥$350/mes · 3–24 meses de antigüedad laboral | [bancoagricola.com/extrafinanciamiento](https://www.bancoagricola.com/extrafinanciamiento) |
| **Sobregiro Elite** | Línea rotativa sin garantía | Debe tener una Cuenta Corriente Óptima (Clásica/Dorada/Platino) **activa**; el nivel Preferencial exige además Cuenta Preferencial Elite | Ingreso >$1,000/mes (Elite) o >$2,000/mes (Preferencial) · edad ≥21 años · DUI vigente | [bancoagricola.com/sobregiro-elite](https://www.bancoagricola.com/sobregiro-elite) |
| **Crédito Personal (Orden de Descuento)** | Cuota fija con descuento de planilla | Debe ser asalariado con descuento por planilla habilitado | Ingreso suficiente vs. cuota (DTI) | [bancoagricola.com/creditos-personas](https://www.bancoagricola.com/creditos-personas) |
| **Crédito Personal (Cargo a Cuenta)** | Cuota fija con débito a cuenta | Cuenta bancaria activa en Bancoagrícola | — | igual |
| **Reestructura / readecuación** | Cambio de plazo o tasa | El crédito debe existir y estar clasificado en alguna categoría NCB-022 (A1–E); sí está disponible con mora, a diferencia de Extrafinanciamiento | Categoría de riesgo actual, historial de pagos | NCB-022 (SSF) + política interna — el detalle exacto no es público |

### El hallazgo que cambia la lógica del agente

`01-reglas-del-agente.md` lista **Extrafinanciamiento** como escalón 6, "para cuando el cliente necesita liquidez puntual" — pero el requisito oficial dice explícitamente **"tarjeta activa, sin mora"**. Eso significa que **a un cliente que ya está atrasado en esa tarjeta, ese escalón no se le puede ofrecer nunca** — sería prometer un producto que el sistema del banco rechazaría, exactamente el guardrail #5 que el banco prohibió ("nunca inventes un producto... que no esté en la lista"). Lo mismo aplica a **Adelanto de Salario**: no sirve para un cliente independiente o cuyo salario no entra por Bancoagrícola (ej. Rosa Hernández, que tiene una tienda — probablemente no es "planillera").

**Esto es precisamente por lo que `consultarOpcionesValidas(clienteId)` no puede ser una lista estática en el prompt — tiene que evaluar estas condiciones en tiempo real contra el estado real del cliente**, y es la razón de negocio, no solo técnica, de por qué la Sección 6 de este documento importa: sin `gpt-realtime-2.1` + MCP (o el equivalente en la cascada: una tool call normal de LLM) devolviendo esta elegibilidad *en el momento de la conversación*, el agente ofrecería productos que el banco no puede honrar — y el jurado, que ya avisó que va a intentar romper el agente, es exactamente el tipo de contradicción que un ingeniero de IA bancario detectaría en dos preguntas.

---

## 8. Decisión final — Opción B (Speech-to-Speech)

> **Para la Opción B, si el equipo construye el caso de voz con S2S nativo, el modelo es `gpt-realtime-2.1`.** Queda descartado Gemini 2.5/3.1 Flash Live para este proyecto específico.

Razón resumida (detalle completo en secciones 5–7):
1. **Latencia y costo** son comparables entre ambos — Gemini es marginalmente mejor, pero la diferencia no es decisiva.
2. **Acceso a datos en tiempo real** (`consultarCliente`, `consultarOpcionesValidas`, `registrarAcuerdo`) es el requisito que sí decide: `gpt-realtime-2.1` tiene MCP remoto nativo + function calling asíncrono, verificado con fuente primaria de OpenAI. Gemini Live bloquea la conversación mientras espera la respuesta de la tool y no soporta actualizar tools a mitad de sesión.
3. La Sección 7 confirma que esas tools **no son opcionales ni decorativas** — sin ellas el agente ofrece productos que el banco rechazaría (Extrafinanciamiento a alguien ya en mora, Adelanto de Salario a alguien no planillero).
4. **Esto no reemplaza la decisión de arquitectura ya tomada en `02-decisiones-y-plan.md` (Opción A, cascada, como arquitectura principal).** Es la respuesta a "si tuviéramos que usar S2S, cuál" — útil para el Q&A y para el caso de voz de demostración, no un cambio del plan de construcción.

### Fuentes de esta sección
- [OpenAI Realtime API Pricing in 2026 — HackerNoon](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions)
- [Gemini 2.5 Flash Live API — Google Cloud docs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/2-5-flash-live-api)
- [Moshi: a speech-text foundation model for real-time dialogue — arXiv 2410.00037](https://arxiv.org/html/2410.00037v1)
- [kyutai-labs/moshi — GitHub](https://github.com/kyutai-labs/moshi)
- [Realtime API Guardrails — LiteLLM docs](https://docs.litellm.ai/docs/proxy/guardrails/realtime_guardrails)
- [openai-agents-python issue #1912 — guardrail no bloquea audio en Python SDK](https://github.com/openai/openai-agents-python/issues/1912)
- [Best STT Providers 2026 — Coval](https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/)
