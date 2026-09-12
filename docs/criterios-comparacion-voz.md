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
| **1. Latencia** | TTFB promedio | [ ] ms | [ ] ms | |
| | Latencia total de turno | [ ] ms | [ ] ms | |
| | Precisión de VAD / Pausas | Alta / Media / Baja | Alta / Media / Baja | |
| | Tiempo de interrupción (Barge-in) | [ ] ms | [ ] ms | |
| **2. Guardrails** | Intercepción previa a voz | Sí / No | Sí / No | |
| | Eficacia contra jailbreaks | % éxito | % éxito | |
| | Sanitización de PII | Sencilla / Compleja | Sencilla / Compleja | |
| **3. Trazabilidad** | Transcripción de texto nativa | Nativa / Requiere proceso extra | Nativa / Requiere proceso extra | |
| | Latencia de Tool Calling | [ ] ms adicionales | [ ] ms adicionales | |
| | Extracción de datos del acuerdo | Fiable / Inestable | Fiable / Inestable | |
| **4. Calidad** | Aceptación del voseo salvadoreño | 1 a 10 | 1 a 10 | |
| | Modulación prosódica empática | 1 a 10 | 1 a 10 | |
| | Pronunciación de montos y siglas | Correcta / Errores | Correcta / Errores | |
| **5. Costos** | Costo por minuto | $[ ] USD | $[ ] USD | |
| | Costo por llamada de 3 min | $[ ] USD | $[ ] USD | |
| | Costo mensual (30k llamadas) | $[ ] USD | $[ ] USD | |
| **6. Infraestructura**| Nivel de Vendor Lock-in | Nulo / Parcial / Total | Nulo / Parcial / Total | |
| | Opción de self-hosting / On-prem| Sí / No | Sí / No | |
| | Soporte SIP / Telefonía | Maduro / Experimental | Maduro / Experimental | |

---

## 4. Preguntas Clave para el Veredicto Final del Equipo

Una vez completada la tabla, el equipo se reunirá para responder:

1. **¿Cuál arquitectura garantiza que una alucinación sobre condonación o plazos ilegales NUNCA suene en el teléfono del cliente?**
2. **¿Cuál opción cumple de manera más directa el requisito del banco de entregar *"transcripción y resultado estructurado"*?**
3. **¿La diferencia en latencia de la Opción B justifica la diferencia en costo operativo mensual y la pérdida de control determinista?**
4. **¿Cuál es la alternativa más viable para tener un prototipo estable y demostrable en el tiempo que resta del hackathon?**
