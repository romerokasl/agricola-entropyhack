# Decisiones, plan de construcción y dashboard

---

## PARTE 1 — Las 5 decisiones que el banco dijo que hay que defender

> Estas van en el pitch y en el README. **Que las sepa decir cualquiera del equipo**,
> no solo el dev. El ingeniero de IA del banco las va a preguntar.

### 1. Pipeline (STT → LLM → TTS) vs. speech-to-speech

**Recomendación: pipeline, canal de TEXTO como principal y voz como demostración.**

Por qué:
- El pipeline te deja **ver y guardar la transcripción en cada paso**. El banco pide
  explícitamente "transcripción y resultado" como evidencia técnica. Speech-to-speech te
  da audio bonito y trazabilidad pobre.
- Con pipeline podés meter el **validador determinista entre el LLM y el TTS**. En
  speech-to-speech no hay dónde meterlo: si el modelo alucina, sale por el parlante.
- En trazabilidad regulatoria bancaria, **poder auditar cada turno no es opcional**.
- Speech-to-speech baja la latencia, pero el banco ya dijo que 4–5 s es manejable.

**El argumento de una línea:** *"Elegimos pipeline porque en cobranza la trazabilidad es
requisito, no preferencia — y porque nos deja validar cada respuesta antes de que llegue
al cliente."*

**Canal principal: texto estilo WhatsApp.** El banco lo recomendó explícitamente. La voz
se demuestra en un caso, no en todos.

---

### 2. Latencia vs. calidad

**Objetivo: < 2 s en voz, 0–15 s en texto** (del doc del equipo; el banco aceptó 4–5 s).

Cómo lo conseguís sin sacrificar calidad:
- **Streaming de la respuesta** — el primer token en pantalla mata la sensación de
  espera aunque la respuesta completa tarde.
- **Indicador de "escribiendo…"** — en un canal tipo WhatsApp es lo natural y compra
  2 segundos gratis de percepción.
- Historial acotado (últimos ~10 turnos + resumen) en vez de mandar toda la conversación.
- `max_tokens` bajo: respuestas de 2–3 frases son más rápidas **y mejores**.

**Medí la latencia y mostrala en el dashboard.** Un p50 y un p95 reales valen más que
decir "es rápido".

---

### 3. Modelo local vs. servicio externo

**Recomendación: servicio externo (API).**

Por qué, en 24 horas:
- Un modelo local decente necesita GPU, descarga de pesos y tuning. Eso son horas que
  salen del pitch.
- La calidad conversacional en español salvadoreño de un modelo grande por API es
  claramente superior a lo que corre en una laptop.
- **La calidad conversacional pesa 20 puntos.** Es el peor lugar para ahorrar.

Cómo defenderlo cuando pregunten por soberanía de datos (y van a preguntar, es un banco):
> *"Para el prototipo usamos API por calidad y tiempo. En producción el banco tiene dos
> caminos: un despliegue privado del modelo en su nube, o un modelo local para los datos
> más sensibles con el mismo contrato de interfaz. Nuestra capa de IA está aislada
> detrás de una interfaz, así que cambiar el proveedor es cambiar un archivo."*

**Esa última frase hay que poder demostrarla.** Tené la capa de IA en un solo módulo.

#### Adenda: ¿es compatible gpt-realtime-2.1 con la infraestructura real de Bancoagrícola?

Investigación de información pública (no tenemos acceso a la arquitectura interna real del banco — esto es lo máximo que se puede saber desde afuera):

- **El grupo (Bancolombia/Cibest) ya es multi-nube: AWS + Azure.** Bancolombia migró ~90+ aplicaciones y su SAP a AWS como socio estratégico, pero **todo su ecosistema digital interno corre sobre Azure DevOps** (700+ aplicaciones). Esto importa porque `gpt-realtime` **también se distribuye como Azure OpenAI Service** dentro de Microsoft Foundry — o sea, el mismo modelo se puede contratar a través de la nube que el grupo ya usa internamente, no solo directo con OpenAI. Es el argumento de "cambiar el proveedor es cambiar un archivo" hecho más concreto: ni siquiera hay que cambiar de nube.
- **Ya existe precedente de vendor externo tocando el canal del cliente.** El bot actual de Bancoagrícola (TABOT, en WhatsApp) lo construyó y opera un proveedor externo (S1) desde 2019. Que un tercero provea la capa de IA conversacional no es un concepto nuevo para el banco — ya lo hacen hoy, aunque con un bot de menú rígido.
- **⚠️ Hallazgo real que hay que decir en voz alta, no esconder:** ni la API directa de OpenAI ni Azure OpenAI ofrecen hoy una región de datos en Latinoamérica para los modelos realtime — los despliegues confirmados de `gpt-realtime`/`gpt-realtime-mini` están en **East US 2 y Sweden Central** únicamente. Es decir: **la voz y el texto de la conversación viajan a EE. UU. o Europa sin importar qué proveedor se elija.** Esto no es un problema para el demo (dato sintético, autorizado explícitamente por el banco), pero es la pregunta de soberanía que hay que responder bien si el jurado la hace.
- **El Salvador sí regula esto, aunque no encontramos el texto exacto.** La SSF tiene normas técnicas prudenciales (NRP-23 sobre gestión de seguridad de la información, NPB4-50 sobre riesgo operacional) que aplican a cualquier servicio de terceros que procese datos de clientes, y hay una reforma legal explícita sobre protección de datos de usuarios bancarios en la nube. No es público el detalle de qué exige exactamente para transferencia internacional de datos — **es la misma pregunta abierta que ya está en la sección 13 de `00-contexto-global.md` ("¿tecnologías del banco?"): hay que preguntarle a los mentores, no asumir.**

**La respuesta defendible para el pitch, con esto ya investigado:**
> *"Para el prototipo, los datos son sintéticos y viajan a la nube del proveedor de IA — hoy eso es EE.UU. o Europa, sea OpenAI directo o Azure OpenAI, porque ningún modelo realtime todavía tiene región en Latinoamérica. En producción, el banco ya opera multi-nube con AWS y Azure a nivel de grupo, así que la ruta natural es Azure OpenAI Service dentro de su propio tenant — mismo modelo, mismo contrato de interfaz, con los controles de cumplimiento que ya usan para sus 700 aplicaciones en Azure. La pregunta de qué exige la SSF exactamente para transferencia internacional de datos de clientes es la única que no podemos responder desde afuera — se la trasladamos a los mentores."*

---

### 4. Reglas vs. autonomía del agente

**Recomendación: autonomía en el TONO, reglas duras en la DECISIÓN.**

Es la respuesta que un banco quiere oír y es la correcta:
- El LLM decide **cómo lo dice** — adapta el registro, el orden, la empatía.
- El código decide **qué se puede ofrecer** — la escalera de opciones, los límites de
  plazo y monto están en código, no en el prompt.
- Temperatura **0.2** (recomendación de Alejandro).
- **Validador determinista** en cada turno (ver `01-reglas-del-agente.md` §5).

**El argumento:** *"La creatividad está en la conversación; la autoridad está en el
código. El modelo nunca decide solo si un plazo es válido."*

---

### 5. Simplicidad vs. más funciones

**Recomendación: un flujo completo y pulido.** El banco lo dijo casi textual:
*"Una funcionalidad estable vale más que diez incompletas."*

El flujo que tiene que estar impecable: **conversar → comprender → negociar → cerrar →
registrar**, con el caso de Karla. Todo lo demás es extra.

---

## PARTE 2 — Respuestas a los 7 puntos del doc interno del equipo

### 1. Manejo de búsqueda de datos: Consultas Estructuradas y Function Calling Tipado

**Decisión definitiva: Consultas SQL directas a Postgres/Supabase mediante Function Calling / Tools tipadas.**

Queda descartado cualquier uso de RAG o Graph-RAG. Los datos financieros del cliente y las reglas de negocio del banco son **100 % estructurados con esquema cerrado**. Recuperarlos mediante similitud semántica o grafos vectoriales introduce aproximaciones probabilísticas, latencia innecesaria y riesgo de alucinación en saldos o fechas, lo cual es inaceptable bajo la regulación de la SSF.

La solución oficial es determinista y auditable:

| Necesidad | Solución técnica exacta | Implementación |
|---|---|---|
| **Datos del cliente** (saldo, cuota, fecha de corte, días de atraso) | **Query SQL directa a Postgres** mediante Tool tipada `consultarCliente(clienteId)` | Supabase / SQL directo |
| **Reglas de negocio** (escalera de opciones, límites de plazo y monto) | **Objeto tipado inmutable en código** mediante Tool `consultarOpcionesValidas()` | Configuración tipada TypeScript/Python |
| **Cierre de gestión** (monto acordado, fecha de pago, tipo de alivio) | **Mutación SQL atómica** mediante Tool `registrarAcuerdo(acuerdoData)` | Inserción en tabla `acuerdos` de Supabase |
| **Contexto de la conversación** | Historial de turnos en memoria + resumen tras 10 turnos | Array de mensajes + compresión contextual |
| **Preferencias del usuario** (canal preferido, horario de contacto) | Columna en la tabla `clientes` | Lectura directa en la consulta inicial |

**Por qué esta arquitectura es superior para un banco:**
- **Exactitud al 100 %**: No hay aproximación ni ambigüedad; los saldos y fechas provienen directamente de la base de datos relacional.
- **Latencia mínima**: Una consulta indexada en Postgres toma < 5 ms, mientras que una búsqueda vectorial o en grafo añade 200–800 ms.
- **Seguridad y Control (Menor Privilegio)**: El agente LLM no tiene acceso libre a la base de datos ni infiere qué proponer. Solo puede invocar herramientas tipadas con parámetros validados por esquema (Zod / Pydantic).
- **Auditoría total**: Cada llamada a una herramienta genera un evento trazable en el log de la conversación (`tool_call`, `arguments`, `response`).

**Defensa ante el jurado:**
> *"Descartamos búsquedas semánticas o vectoriales porque en un banco los datos transaccionales son deterministas. Usamos Function Calling con validación estricta de esquemas: el LLM razona la conversación, pero los datos y las reglas provienen de fuentes estructuradas verificadas."*

---

### 2. Dataset (emi) + monitoreo y data-drift

- El banco confirmó: **el modelo lo hacen ustedes, "no es rocket science"**, y pueden
  usar un **dataset de juguete**.
- ⚠️ **Corrección (12 sep):** este doc afirmaba que ya existía un generador sintético
  determinista de la investigación previa (2,008 clientes). **No está en el repo** — el
  código pre-evento se removió a propósito (ver `supabase/README.md` y el commit
  `452de0e`). El generador se construyó de cero durante el evento: vive en
  `scripts/generate-seed.mjs` y está documentado en `supabase/README.md`.
- **Monitoreo y data-drift: documentarlo, no construirlo.** El `ml/README.md` del repo
  ya menciona PSI y Wasserstein. Una sección en el README diciendo *cómo* se
  monitorearía en producción es suficiente y suma en "solidez técnica". Construirlo hoy
  no suma nada al demo y cuesta horas.

---

### 3. Modelo de IA: API o local

Ver decisión #3 arriba. **API.**

| Criterio | API externa | Modelo local |
|---|---|---|
| Calidad en español SV | Alta | Media |
| Tiempo de setup | Minutos | Horas |
| Latencia | Red + inferencia | Sin red, pero hardware |
| Costo por demo | Centavos | $0 |
| Soberanía de datos | ⚠️ el argumento en contra | ✅ |
| **Veredicto para hoy** | **✅** | Fase 2 |

**Prompts heurísticos fijos:** mantené **uno solo** (el system prompt) más las
herramientas tipadas. Prompts por etapa multiplican el mantenimiento y las
inconsistencias. Si necesitás comportamiento por etapa, pasá la etapa como variable en
el contexto, no como prompt distinto.

**Resumen en el pipeline:** solo cuando el historial pase de ~10 turnos. Antes de eso
es costo sin beneficio.

**STT/TTS:** usá el del mismo proveedor si existe, por simplicidad de credenciales.

---

### 4. Dashboard — qué métricas

El banco le da **10 puntos**. No te pasés de ambicioso, pero que las que estén sean
reales, no hardcodeadas.

**Nivel 1 — imprescindibles (mostrar el resultado de la gestión):**
- Conversaciones gestionadas (total y por estado)
- **% de cierre con acuerdo** ← la métrica estrella, es "efectividad de la gestión"
- Distribución de acuerdos por tipo (mover fecha / abono parcial / micro-plan / …)
- **Mora evitada en $** (suma de las cuotas con acuerdo cerrado)
- Clientes en riesgo detectados, por banda

**Nivel 2 — solidez técnica (esto impresiona a Alejandro):**
- **Latencia por turno: p50 y p95**, medida de verdad
- **Consumo de tokens y costo estimado en tiempo real** ← estaba en el doc del equipo y
  es un detalle que casi nadie va a tener
- Tasa de intervención del validador (cuántas respuestas se bloquearon)
- Tasa de escalamiento a humano

**Nivel 3 — si sobra tiempo:**
- Comparación contra cobranza tradicional
- Provisiones evitadas según NCB-022
- Alertas por incremento en la tasa de consumo de tokens

> **El "Budget de tokens en tiempo real" del doc del equipo es una gran idea.** Un
> dashboard de cobranza que además muestra cuánto cuesta operar el agente contesta sola
> la pregunta "¿y esto cuánto vale?". Priorizalo sobre cualquier gráfica bonita.

⚠️ Al dibujar cualquier gráfica, usá los tokens de marca. **El cliente nunca ve rojo;
la consola interna sí puede.**

---

### 5. Registro de logs (joshua)

- **Transcripción completa de cada conversación** — el banco lo pide explícitamente
  como evidencia técnica. Tabla `conversaciones` + `turnos`.
- Cada turno guarda: rol, texto, timestamp, latencia_ms, tokens_in, tokens_out,
  validador_ok, modelo_version.
- **Resultado estructurado por conversación**: tipo de acuerdo, monto, fecha, o motivo
  de no-acuerdo.
- **Alembic**: es de Python/SQLAlchemy. El repo usa **Supabase**, donde las migraciones
  son SQL versionado. **No mezclen dos sistemas de migración hoy** — usen el de Supabase
  y listo. Alembic solo tendría sentido si el servicio de Python fuera dueño del
  esquema, y no lo es.

---

### 6. Canales

| Canal | Para el demo | En producción |
|---|---|---|
| **Texto tipo WhatsApp** | ✅ **Principal** — el banco lo recomendó | WhatsApp Business API |
| **Voz** | ✅ Un caso, para demostrar el pipeline | Integración con telefonía |
| SMS | Mostrar el formato (caso Don Tito) | Proveedor SMS |
| Correo | Mencionarlo | — |

**Todo simulado, nada conectado.** El banco fue explícito. En el README poné una tabla
"qué está simulado y qué es real" — eso es honestidad técnica y el jurado la premia.

---

### 7. Tecnologías del banco

No lo dijeron en el brief. **Preguntá a los mentores** — si alguien contesta, es una
slide gratis ("se integra con lo que ya tienen").

Lo que sí sabemos y sirve igual: Bancoagrícola es parte de **Grupo Cibest/Bancolombia**,
invierte **$17.5 M en tecnología en 2026**, tiene **750,000 usuarios activos de banca
móvil**, y opera **Nequi** y **Wompi**. El argumento no necesita saber su stack:
*"esto corre sobre los canales que ya tienen y usa los productos que ya venden."*

---

## PARTE 3 — Orden de construcción (lo que queda del hackatón)

Construí en este orden porque cada paso desbloquea el pitch, no porque sea el orden
técnico más elegante.

| # | Qué | Por qué primero | Puntos que toca |
|---|---|---|---|
| 1 | **Datos del cliente + reglas en código** | Sin esto el agente no tiene de qué hablar | base |
| 2 | **Agente conversacional con el system prompt** | Es el 40 % de la nota | 40 |
| 3 | **UI tipo WhatsApp, un flujo completo (Karla)** | Es lo que se ve en el demo | 20 |
| 4 | **Registro: transcripción + resultado en BD** | El banco lo pide textual | 20 |
| 5 | **Validador determinista + batería de ataque** | El jurado va a intentar romperlo | 20 |
| 6 | **Dashboard con métricas reales** | 10 puntos, y cierra la narrativa | 10 |
| 7 | Voz (STT/TTS) en un caso | Demuestra el pipeline completo | extra |
| 8 | Modo director de demo | Saltar al caso que querés mostrar | extra |

### Hitos

- **Flujo de Karla navegable de punta a punta** → cuanto antes, es el corazón del demo
- **CONGELAR FEATURES** con 6 h restantes — después solo se pule, se prueba y se ensaya
- **Grabar el video de respaldo** con 4 h restantes. El wifi va a fallar; siempre falla
- **Últimas 3 h: cero código nuevo.** Solo pitch y ensayo

### Reglas de supervivencia

- **Profundidad > amplitud.** Un flujo completo y pulido gana contra seis a medias.
  Lo dijo el banco, no yo.
- Si una tarea va a tomar más de 45 min, pará y buscá dos alternativas más baratas.
- El estado del demo tiene que resetearse con **un comando**. Lo vas a correr veinte veces.
- **Probá el modo sin red temprano**, no a las 3 a.m.
- Dormí por turnos. El pitch pesa demasiado para darlo en estado zombie.

---

## PARTE 4 — Estructura del pitch

1. **El gancho (20 s).** *"Bancoagrícola tiene 30,000 clientes en incumplimiento. El 90 %
   es mora temprana: se les olvidó. Hoy los atiende un bot que — palabras de ustedes —
   tiene cierta rigidez y sigue una ruta de conversación específica."*
2. **La persona (20 s).** Karla, 27, Soyapango. Cobra el 15 y el 30. Su cuota vence el 8.
   Paga tarde todos los meses sin ser mala pagadora: el calendario está mal armado.
3. **La tesis y los 3 diferenciadores (20 s).** *"No es solo un cobrador. Es Anticipa Bancoagrícola: (1) Precisión auditable ante la SSF con explicabilidad SHAP, (2) Cobranza empática que orquesta productos reales del banco, y (3) Rentabilidad activa: monetizamos a clientes sanos con cross-selling y up-selling, convirtiendo la prevención en ingresos."*
4. **El demo (90 s).** La conversación completa con Karla: comprender → detectar la
   desalineación → proponer mover la fecha → cerrar → **mostrar el registro**.
5. **La prueba de control (20 s).** Pedile al jurado que intente romperlo. O rompelo vos
   delante de ellos y mostrá cómo responde. **Esto es lo que nadie más va a hacer.**
6. **El dashboard (20 s).** % de cierre, mora evitada, provisiones liberadas NCB-022, conversión comercial Tier A, latencia p95 y costo en tokens.
7. **El cierre (15 s).** *"Corre sobre los canales que ya tienen, usa los productos que
   ya venden, y el tono empático además es cumplimiento de la Ley de Protección al
   Consumidor."*

### Preguntas del Q&A — tené la respuesta de 30 segundos lista

- ¿Cómo controlan las alucinaciones? → prompt + temperatura 0.2 + **validador
  determinista** + reglas en código, no en el prompt
- ¿El modelo es auditable ante la SSF? → **100 % auditable**: usamos modelos de caja blanca / interpretabilidad con **SHAP (TreeExplainer)**. Cada intervención tiene registrados los 3 factores matemáticos de estrés que la justificaron.
- ¿Cómo monetizan si es un sistema de cobranza? → **Rentabilidad Activa**: filtramos a los clientes con deuda saldada o 0 mora (**Tier A Prime**) y disparamos ofertas oportunas de cross-selling y up-selling (Adelanto de Salario, Extrafinanciamiento limpio, upgrade de tarjeta).
- ¿Qué hacen con la mora grave (+120 días, Tier D y E)? → La probabilidad de recuperación automática decae fuertemente. El bot emite recordatorio formal y **reduce el esfuerzo de rescate automatizado, derivando de inmediato a un ejecutivo humano** para gestión personalizada o cobranza especializada.
- ¿Local o API, y qué pasa con los datos? → ver decisión #3
- ¿Y quien no tiene smartphone? → **Don Tito**: SMS + corresponsal
- ¿No están canibalizando los intereses de mora? → *el interés de mora es ingreso de baja
  calidad: trae provisión, costo de cobranza y costo reputacional. Un cliente que no cae
  en mora tiene mayor valor de vida y evitar el deterioro de categoría NCB-022 libera
  capital*
- ¿Esto no es solo un recordatorio? → **no: negocia y cierra un acuerdo registrable**
- ¿Cuánto cuesta operarlo? → **está en el dashboard, en vivo**
- ¿De dónde salen los datos? → dataset de juguete, como lo autorizaron; el adaptador
  mapea un dataset real en menos de 30 minutos
