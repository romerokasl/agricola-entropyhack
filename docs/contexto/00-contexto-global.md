# Contexto global — Entropy Hack 2026 · Reto Bancoagrícola

> **Documento maestro.** Une toda la investigación previa (6 sep) con el brief oficial
> del banco (12 sep, 9:58–10:30 a.m.). Si alguien del equipo o una sesión nueva de IA
> lee un solo archivo, que sea este.
>
> Última actualización: 12 sep 2026, durante el evento.

---

## ⚠️ LO PRIMERO: el reto cambió de forma respecto a lo que asumimos

Antes del brief interpretamos el reto como **una app preventiva con dashboard y
pantallas** ("Al Día", el Escudo de Récord Crediticio).

El brief oficial dejó claro que el reto es **un AGENTE CONVERSACIONAL DE COBRANZA
PREVENTIVA**. La conversación no es una feature del producto: **la conversación ES el
producto**. Lo dice la rúbrica: *calidad conversacional* y *efectividad de la gestión*
pesan 20 puntos cada una.

**Esto no invalida la investigación previa — la reubica.** Los 5 insights locales
(quincena, remesas, ventana de 10 días, corresponsales, productos existentes) dejan de
ser pantallas y pasan a ser **el cerebro del agente**: lo que entiende, lo que ofrece y
lo que puede negociar. Ver `01-reglas-del-agente.md`.

---

## 1. El reto, en la versión oficial del banco

### El flujo crítico (textual de la lámina)

```
01 Conversar  →  02 Comprender  →  03 Adaptarse  →  04 Negociar  →  05 Cerrar  →  06 Registrar
Voz, WhatsApp     Contexto e        Cada perfil      Dentro de      Acuerdo o     Transcripción
o ambos           intención         de cliente       las reglas     sig. paso     y resultado

          CLIENTE FICTICIO  →  RESULTADO REGISTRADO
```

> *"No buscamos solo respuestas inteligentes. Buscamos una gestión completa, empática,
> trazable y orientada a un resultado."*

> *"Prioricen el flujo crítico: conversar, comprender, negociar, cerrar y registrar.
> Una funcionalidad estable vale más que diez incompletas."*

### Lo que debe funcionar y ser visible

| Experiencia | Inteligencia y control | Evidencia técnica |
|---|---|---|
| Conversación natural | Mantener el objetivo | Demo estable |
| Tono cálido y profesional | Decidir dentro de las reglas | Repositorio y README |
| Empatía y adaptación | Cerrar con resultado | Transcripción y resultado |
| Tiempo conversacional | **Explicar la lógica** | Dashboard con métricas |

### 🎯 Pesos de los criterios técnicos (de la lámina)

| Criterio | Peso |
|---|---|
| Calidad conversacional | **20** |
| Efectividad de la gestión | **20** |
| Solidez técnica | **20** |
| Dashboard y datos | **10** |
| **Subtotal técnico** | **70** |

⚠️ Suman **70**. Los **30 restantes** no se mostraron — casi con seguridad son pitch,
negocio e innovación. **Preguntar a los organizadores.** No asumas que el 100 % es
técnico: un tercio de la nota probablemente se decide hablando.

---

## 2. Quiénes dieron el brief

- **Ricardo González** — a cargo de **toda la gestión de cobros del banco**, personas y
  pymes. Dio la parte de negocio y filosofía.
- **Alejandro Morcia** — **Gerencia de Capacidades Analíticas**, Ingeniero de
  Inteligencia Artificial. Dio la parte técnica y la arquitectura de referencia.

Saber esto importa para el pitch: **hay un cobrador y un ingeniero de IA en la sala.**
El primero va a juzgar si el tono y las reglas son realistas; el segundo si la
arquitectura se sostiene.

---

## 3. La filosofía del banco (úsenla, es su propio lenguaje)

> *"Si hablamos de cobranzas, no todo se trata de cobrar… sino más bien ayudar a
> personas a proteger su futuro financiero o la salud financiera de los clientes."*
> — Ricardo González

> *"¿Y si te dijera que cobranza no se trata de cobrar, sino de ayudar a personas a
> proteger su futuro financiero?"* — lámina del banco

- Propósito corporativo: **"Bienestar para todos"**.
- La analogía que usó Ricardo: la salud financiera es como la salud física — se
  mantiene con hábitos, no con emergencias.
- El cliente arquetipo del banco se llama **Valentina**, y sus metas son: **estudios,
  hogar, metas personales, finanzas saludables**.
- Los tres pilares del "factor humano" que la tecnología **no** reemplaza:
  **Empatía · Comprensión · Soluciones humanas**.

> **Para el pitch:** nuestra tesis previa ("la cobranza tradicional le cobra al banco su
> dinero; nosotros le cuidamos al cliente su récord") **coincide exactamente** con lo
> que dijo el jefe de cobranzas. No hay que convencerlo: hay que demostrárselo
> funcionando.

---

## 4. Los desafíos, según el banco

Por qué la gente cae en mora (lámina "El reto que queremos resolver"):

1. **Olvidan** las fechas de pago.
2. **Reciben demasiados mensajes** — el del banco es el que menos ven.
3. **Dejan las cosas para después** (postergación).
4. **A veces atraviesan momentos financieros difíciles** — pérdida de empleo,
   situación médica.

Lo que la tecnología puede aportar: detectar riesgos antes de que aparezcan, enviar
recordatorios inteligentes, hablar por canales digitales, personalizar la ayuda.

---

## 5. 🔑 Datos que dio el banco en vivo (oro para el pitch)

| Dato | Valor | Fuente |
|---|---|---|
| Clientes en situación de incumplimiento en algún momento | **~30,000** | Ricardo, en vivo |
| De esos, **mora temprana** | **~90 %** | Ricardo, en vivo |
| Canales que usa hoy cobranzas | **Voz (mucho)**, WhatsApp, correo, SMS | Ricardo, en vivo |
| Hoy usan bots | Sí, para grupos específicos | Ricardo, en vivo |
| Limitación de esos bots | **"Tiene cierta rigidez… seguir una ruta de conversación específica"** | Ricardo, en vivo |

### Por qué el 90 % es el número más importante del pitch

De ~30,000 clientes en incumplimiento, **27,000 son mora temprana**: se les olvidó, no
les llegó el mensaje, lo postergaron. **No es gente que no puede pagar — es gente que
no pagó a tiempo.** Ese segmento se recupera con una conversación bien hecha en el
momento correcto, no con presión.

**Y el hueco que deja el banco solito:** sus bots actuales son rígidos, siguen un guion
fijo. Ricardo lo dijo con esas palabras. Nuestro agente existe para cubrir exactamente
ese hueco. **Esa frase es el arranque del pitch.**

---

## 6. Arquitectura de referencia (del banco)

> *"Una arquitectura posible, no la única."*

```
ENTRADA              INTELIGENCIA          ACCIÓN              OBSERVABILIDAD
Cliente y canal  →   Agente de IA      →   Registro        →   Dashboard
Voz · WhatsApp       Reglas · contexto     Resultado           Métricas · logs
· web                · respuesta           · base de datos
```

**Dos pipelines que plantearon:**

- **A)** `Audio → Speech-to-Text → LLM o agente → Text-to-Speech → Audio`
- **B)** `Audio → Modelo speech-to-speech → Audio` *(más ambicioso)*

**Objetivo de latencia: < 2 s por turno en voz.** Alejandro aclaró en vivo que, por el
límite de tiempo del reto, **4–5 s es manejable**.

Nuestro objetivo interno (del doc del equipo): **llamadas < 2 s; texto y audios 0–15 s**.

### Las 5 decisiones que el banco dijo que TENEMOS QUE DEFENDER

1. Pipeline vs. speech-to-speech
2. Latencia vs. calidad
3. Modelo local vs. servicio externo
4. Reglas vs. autonomía del agente
5. Simplicidad vs. más funciones

> *"La mejor arquitectura no es la más compleja: es la que funciona, se puede explicar y
> se mantiene estable durante el demo."*

**Nuestras respuestas están en `02-decisiones-y-plan.md`. Que las sepa decir cualquiera
del equipo, no solo el dev.**

---

## 7. Reglas y límites que dio el banco (esto se evalúa)

### Guardrails obligatorios — Alejandro fue explícito

El agente **NO** puede:

- ❌ Ofrecer **productos de otro banco**
- ❌ Mencionar **productos que no existen**
- ❌ Llevar a una **conciliación que no se puede cumplir**
- ❌ Aceptar plazos irreales ("te pago en 70 días", "en dos años")

Plazos **reales** que maneja el banco: los créditos se pagan **en 30 días**. Lo que se
puede negociar es **corto plazo**: la fecha de vencimiento, o **1 a 3 días después**.
(Ricardo lo confirmó en el Q&A.)

### 🚨 El jurado va a intentar romper el agente EN VIVO

> *"En el momento del demo, pues podemos solicitar que le hagan una pregunta de este
> tipo, y si responden que sí, pues es porque no está lo suficientemente limitado el
> modelo."* — Alejandro

**Esto es una prueba anunciada.** Hay que probarla nosotros veinte veces antes. Ver la
batería de ataque en `01-reglas-del-agente.md`.

### Temperatura

Alejandro recomendó **temperatura entre 0 y 0.2**. Documentarlo y decirlo en el pitch.

---

## 8. Alcance: qué es simulado y qué NO (la aclaración importante)

Preguntas del Q&A, respuestas textuales del banco:

| Pregunta | Respuesta |
|---|---|
| ¿Preventivo o recuperatorio? | **"El enfoque inicial es previo… lo que queremos es evitar que el cliente caiga."** Preventivo. |
| ¿Podemos usar los colores y la marca del banco? | **Sí**, para fines del prototipo. Recomiendan que el mockup **se parezca a WhatsApp** (o Telegram / mensajes). |
| ¿Conectado a WhatsApp real? ¿Pagos reales? | **No. "Todo demo, nada real, nada conectado con nada."** |
| ¿Nos dan sus modelos analíticos? | **No.** *"El modelo analítico lo pueden hacer ustedes. No es rocket science."* Pueden inventar un **modelo de juguete** y un **dataset de juguete**. |
| ¿Nos dan datos de clientes? | Pueden **simular un user persona** y una API que devuelva límite, nombre, etc. |
| ¿Qué insumo nos dan? | **El texto de un guion de una llamada de cobranza real del banco.** El equipo decide si el agente abre o el cliente. |

### ⚠️ "Demo" NO significa "mockup estático"

Esta distinción vale puntos y hay que tenerla clara, porque el equipo quiere algo
desplegado y **eso es totalmente compatible con lo que pidió el banco**:

| Lo que el banco pide simular | Lo que SÍ puede ser real y desplegado |
|---|---|
| El **canal** (que se vea como WhatsApp, no que lo sea) | La app, desplegada en una URL pública |
| Los **datos** del cliente (dataset de juguete) | La base de datos, con registros reales de la conversación |
| El **pago** (no se mueve dinero) | El agente LLM, respondiendo de verdad |
| La **integración** con sistemas del banco | El dashboard, con métricas calculadas de verdad |
| — | Speech-to-text / text-to-speech funcionando |
| — | Los logs y las transcripciones, persistidos |

El banco pidió explícitamente **"demo estable, repositorio y README, transcripción y
resultado, dashboard con métricas"**. Eso es software funcionando, no un Figma.
**Construir algo desplegado y pulido no contradice el brief: lo cumple mejor que nadie.**

---

## 9. Los 5 insights locales — ahora viven DENTRO del agente

Siguen siendo nuestro diferenciador. Cambia dónde se usan.

| Insight | Antes (pantalla) | Ahora (en la conversación) |
|---|---|---|
| **1. La quincena** — en El Salvador se cobra el 15 y el 30 | Card en la app | El agente **detecta** que la cuota vence el 8 y **ofrece mover la fecha al 16**. Costo cero para el banco. |
| **2. Las remesas** — ~24 % del PIB; el banco ya las cobra en su app | Gráfica | *"Veo que tu remesa suele entrar el día 5 y tu cuota vence el 3. ¿Te sirve que la movamos dos días?"* **Ningún buró tiene ese dato.** |
| **3. Ventana de 10 días** — los burós actualizan los primeros 10 días del mes (ley SV) | Contador visual | El agente lo dice con exactitud: *"esto se reporta el 10; tenés 6 días"*. Urgencia **honesta**, no falsa. |
| **4. Los 890+ corresponsales**, 100 % de distritos | Mapa | *"Podés pagar en el corresponsal a dos cuadras"* — responde a la objeción "¿y quien no usa app?" |
| **5. Productos que ya existen** — Adelanto de Salario, Extrafinanciamiento, Sobregiro Elite | Catálogo | **Son las opciones que el agente puede ofrecer sin inventar nada.** Cumple el guardrail de "no mencionar productos que no existen". |

> El insight #5 es el que más vale ahora: el banco **prohibió** inventar productos.
> Nosotros ya tenemos la lista real de los que existen. Eso nos deja negociar de verdad
> mientras otros equipos o inventan (y rompen la regla) o no ofrecen nada.

---

## 10. Contexto de industria y regulación (investigación previa, sigue vigente)

### Bancoagrícola

- **Banco #1 de El Salvador**: 24 % de activos, 24.2 % de cartera bruta, 25.4 % de depósitos.
- Parte de **Grupo Cibest** (matriz de Bancolombia desde 2025).
- **750,000 clientes activos** en banca móvil. App 4.8★, +1 M descargas.
- Inversión 2026: **$22.42 M**, de los cuales **$17.5 M en tecnología**.
- **62 agencias, +890 corresponsales financieros**, cobertura 100 % de distritos.
- Nequi (fintech del grupo): 71 % de usuarios menores de 35. Wompi: $68 M transados.
- Ya tienen **"Salud Financiera"** y **"Financiera-mente"**: contenido educativo pasivo.
  Nuestro agente es la versión accionable de eso.

### Sistema bancario salvadoreño (ABANSA, junio 2026)

- Cartera total: **$19,978.8 M** (+10.4 % a/a)
- Consumo + vivienda: **$9,348.2 M** → Bancoagrícola ≈ **$2,262 M**
- Tarjetas de crédito: **$1,374 M** (+10.8 %)
- **Morosidad del sistema: 1.50 %** · Reservas $437 M cubriendo $299 M en mora

> ⚠️ **No pitchees "hay una crisis de mora".** 1.50 % es bajísimo y el jurado es
> bancario. El framing correcto: la cartera crece 10 % al año, la originación nueva es
> digital y joven, **el riesgo está en el flujo, no en el stock**. Y de los 30,000 en
> incumplimiento, 27,000 son recuperables con una conversación.

### Regulación (nos da credibilidad y es un argumento de cumplimiento)

- **Ley de Regulación de los Servicios de Información sobre el Historial de Crédito**
  (reforma ago-2021): los burós actualizan registros **los primeros 10 días de cada
  mes**; finiquito en máx. 7 días hábiles; el usuario recibe aviso cuando consultan su
  historial. Burós en SV: **Equifax, TransUnion, InfoRed**.
- **NCB-022 (SSF)**: clasifica activos por días de mora (A1…E) y determina el % de
  reserva. Evitar el deterioro de categoría **libera provisiones** — ahí está el ROI.
  *(Pendiente: bajar el PDF y poner la tabla real.)*
- **Ley de Protección al Consumidor**: prohíbe cobros **difamatorios o injuriantes**.
  → **El tono empático no es solo bonito: es cumplimiento normativo.** Slide del pitch.

### Evidencia académica

**PNAS 2025**, experimento de campo con **13 millones de personas**: recordatorios
conductuales redujeron la morosidad a 60 días entre **0.42 y 0.57 pp**; enmarcar en
**porcentaje** en vez de dólares suma 0.14 pp; **una sola acción recomendada por
mensaje** funciona mejor que varias.

> El hallazgo de "una sola acción" **ya está en las reglas de tono del agente**. Es raro
> tener una regla de copy respaldada por un experimento de 13 millones de personas.
> Decirlo en el Q&A vale.

---

## 11. Estado del repositorio (12 sep, mediodía)

`github.com/romerokasl/agricola-entropyhack` · rama `main` · commit `057404a`

**Stack actual:** Next.js **14.2.24** + React 18 + Tailwind **3** + Supabase +
**microservicio Python FastAPI** (`ml/api.py`).

Verificado hoy en el contenedor: `npm ci` ✅ · `pip install -r ml/requirements.txt`
✅ · `npm run build` ✅ · FastAPI `/health` ✅ · `/api/predict` con fallback ✅.

> ⚠️ Usar **`npm ci`**, no `npm install` — `CLAUDE.md` lo prohíbe porque reescribe el
> lockfile y genera conflictos entre las 4 laptops.

### ⚠️ Observación honesta sobre el repo

El repo hoy está construido alrededor de **`/api/predict`**: un scorer de riesgo con
fallback determinista. Está bien hecho — el fallback es buena ingeniería.

**Pero eso responde al ~20 % de la rúbrica.** El banco dijo que el modelo analítico "no
es rocket science" y que el insumo (a quién cobrar) **se puede dar por hecho**. Los 40
puntos de *calidad conversacional* + *efectividad de la gestión* están en **la
conversación, la negociación y el cierre**, que hoy no existen en el repo.

**Recomendación:** congelar el scorer donde está (ya funciona, ya explica sus razones) y
volcar todo el esfuerzo restante en el agente conversacional, el registro y el
dashboard. Ver `02-decisiones-y-plan.md`.

> ⚠️ **El scorer es interno: su texto NUNCA se le muestra al cliente.**
> `app/api/predict/route.ts` trae un `adviceMap` con campos `empatheticMessage` listos
> para mostrar, y el nivel `CRITICAL` salta directo a una readecuación — que es el
> **escalón 7** de la escalera, violando la regla "ofrecé el escalón mínimo suficiente".
> Además esos textos no pasan por el validador determinista. El scorer solo decide
> **a quién** contactar y aporta contexto de riesgo; **el mensaje que ve el cliente lo
> genera siempre el agente y siempre pasa el validador.** No cablear `empatheticMessage`
> a la UI.

### Nota de marca

El `tailwind.config.ts` del repo trae `agricola-blue #003B71` como color corporativo.
Las láminas oficiales del banco de hoy son **amarillo + grafito + verde**, sin azul
dominante. Los colores que extraje del sitio real coinciden con las láminas:

```
brand-yellow  #FDDA24   relleno, NUNCA texto (1.5:1 sobre blanco)
brand-ink     #2C2A29   texto principal
verde         acento (aparece en las láminas del banco)
```

**Y el mockup debe parecerse a WhatsApp**, dicho por el banco. Eso manda sobre cualquier
decisión de diseño previa.

---

## 12. Archivos de este paquete

| Archivo | Qué contiene |
|---|---|
| `00-contexto-global.md` | Este documento |
| `01-reglas-del-agente.md` | System prompt, reglas de negociación, guardrails, batería de ataque |
| `02-decisiones-y-plan.md` | Las 5 decisiones a defender, los 7 puntos del doc del equipo, orden de construcción, métricas del dashboard |
| `03-seleccion-modelo-llm.md` | Decisión de LLM (compartida con `voice/pipeline/docs/model-selection.md`): comparación paga y cadena de fallback a costo cero |
| `05-productos-y-ncb022.md` | Análisis y aplicación al proyecto: por qué importa la elegibilidad de cada producto, fórmula de "provisiones evitadas" para el dashboard, distinción NCB-022 vs. ventana de 10 días |
| `06-ncb022-norma-completa.md` | **La referencia operativa.** Transcripción completa de NCB-022 (Consumo y Vivienda — Empresa excluido por decisión del equipo) + reglas de elegibilidad de cada producto en formato listo para que el agente/validador lo consulte y no ofrezca nada que el banco rechazaría |
| `../estado-del-agente.md` | **Qué funciona hoy, verificado contra servicios reales**, qué falta, y las fallas que solo aparecieron al correrlo |

---

## 13. Preguntas abiertas para los organizadores

- [ ] **¿Cuáles son los 30 puntos que faltan** para completar 100? (los técnicos suman 70)
- [ ] ¿Cuánto dura el pitch y en qué formato?
- [ ] ¿Cuándo entregan **el guion de la llamada de cobranza**? ¿En qué formato?
- [ ] ¿El demo se hace en nuestra laptop o en la del evento? (define si podemos correr
      el servicio de Python local)
- [ ] ¿Habrá mentores del banco disponibles durante la noche?
