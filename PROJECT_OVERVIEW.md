# Inventario Completo del Repositorio — Anticipa Bancoagrícola (EntropyHack 2026)

Este documento resume todos los componentes, herramientas, automatizaciones, esquema de datos y estándares técnicos configurados en el repositorio.

---

## 📋 1. Misión y Diferenciadores Oficiales

* **Plataforma**: **Anticipa Bancoagrícola** — Motor Predictivo, Cobranza Empática y Rentabilidad Activa.
* **Reto Oficial**: Transformar la cobranza tradicional en una gestión preventiva que proteja el récord crediticio de los salvadoreños y multiplique el valor del banco.
* **Diferenciador 1 (Precisión Auditable SSF)**: Modelos supervisados explicables mediante **valores SHAP**, garantizando predictibilidad 100% auditable ante la Superintendencia del Sistema Financiero.
* **Diferenciador 2 (Cobranza Empática y Accionable)**: Detección de patrones locales salvadoreños (quincenas 15/30, remesas, ventana de buró de 10 días, red física de 890+ corresponsales) y orquestación con productos reales de Bancoagrícola mediante una escalera de 8 opciones.
* **Diferenciador 3 (Rentabilidad Activa - Tier A)**: Detección proactiva de clientes con deuda saldada o 0 días de atraso (**Tier A Prime**) para detonar oportunidades automáticas de **cross-selling y up-selling** sin fricción.

---

## 🔄 2. Pipeline de la Aplicación

El sistema unifica dos canales de interacción:
1. **Flujo Outbound (Proactivo)**:
   * Batch diario nocturno (03:00 AM) tras el cierre contable del core bancario.
   * Filtro de supresión reactiva inmediata cuando el cliente realiza su pago.
   * Inferencia con el modelo predictor y segmentación por Tiers:
     * **Tier A Prime (Deuda saldada / 0 días)**: Bypass de cobranza + ofertas comerciales activas.
     * **Tier A Preventivo (0-14 días)**: Recordatorio amistoso y facilidades de pago (alinear a quincena, débito automático).
     * **Tier B y C (14-31 días y 32-120 días)**: Recordatorios prioritarios y agente conversacional empático dentro de límites duros de negocio.
     * **Tier D-E+ (120-365+ días)**: Recordatorio formal; menor resistencia del bot y derivación inmediata a ejecutivo humano.
2. **Flujo Inbound (Receptivo)**:
   * El cliente inicia el contacto por canal digital (WhatsApp/Web/Voz).
   * Consulta en tiempo real a Supabase (score de riesgo, factores SHAP, perfil financiero y categoría NCB-022).
   * El agente resuelve la consulta principal del cliente aplicando las reglas duras de opciones elegibles.

---

## 🤖 3. Habilidades Especializadas para Asistentes de IA (`.agents/skills/`)

* **`shadcn`**: Fuente primaria oficial para todos los componentes de interfaz de usuario.
* **`motion`**: Estándar de animación de alto rendimiento con `motion/react` de [motion.dev](https://motion.dev).
* **`backend`**: Pautas para Route Handlers en Next.js App Router, Zod validation y clientes de Supabase con service role.
* **`security`**: Protocolos de seguridad bancaria, enmascaramiento estricto de PII (DUI, números de tarjeta) y Row-Level Security (RLS).
* **`health-checks`**: Monitoreo de salud del BFF y del microservicio ML.
* **`bancoagricola-ui`**: Identidad corporativa de Bancoagrícola: Amarillo `#FDDA24` (relleno, nunca texto) y Grafito `#2C2A29`. **El cliente nunca ve rojo.**

---

## 🎨 4. Frontend y Canal Conversacional (Next.js 14 App Router)

* **Canal tipo WhatsApp (`/chat/[cliente]`)**:
  * Interfaz de mensajería optimizada para simular WhatsApp, canal recomendado explícitamente por Bancoagrícola.
  * Modo Outbound (`/chat/karla`) y modo Inbound (`/chat/karla?apertura=cliente`).
  * Respuestas en streaming, indicador visual de escritura y tipografía optimizada.
* **Caso de Control (`/chat/marta`)**:
  * Retorna `409 NO_CONTACTAR`: demuestra que el sistema discrimina inteligentemente y no molesta a clientes sanos.
* **Tokens de Color Oficiales**:
  * Amarillo Corporativo: `#FDDA24` (botones y badges con texto oscuro encima).
  * Texto Oscuro Grafito: `#2C2A29` (máximo contraste y legibilidad).
  * Tonos de tranquilidad: Verde esmeralda y ámbar suave. Rojo reservado estrictamente para consolas de riesgo internas.

---

## ⚡ 5. Backend y Agente Conversacional (`lib/agent/` & `app/api/`)

* **Orquestador de Turnos (`app/api/chat/route.ts`)**:
  * Procesa cada intervención del usuario coordinando el LLM, las tools tipadas y el validador.
* **Capa de Inteligencia (`lib/agent/`)**:
  * System prompt versionado con dialecto y voseo salvadoreño natural y cálido.
  * Reglas de negociación, escalera de 8 opciones y límites de plazo/monto codificados en TypeScript (no librados a la improvisación del LLM).
* **Tools Tipadas (Zod + Postgres Relacional)**:
  * `consultarCliente`: Consulta datos exactos de deuda, fechas y categorización NCB-022.
  * `consultarOpcionesValidas`: Devuelve solo los productos bancarios para los que el cliente califica en tiempo real.
  * `registrarAcuerdo`: Mutación atómica en la tabla `acuerdos`.
* **Validador Determinista**:
  * Filtro de seguridad sin LLM que corre en cada turno antes de emitir la respuesta: bloquea términos hostiles, jergas de cobranza judicial, menciones de otros bancos, o alucinación de montos inexistentes.

---

## 🧠 6. Módulo de Machine Learning & Explicabilidad (`ml/`)

* **Microservicio FastAPI (`ml/api.py`)**:
  * Endpoints `/health`, `/docs` (Swagger UI) y `POST /predict`.
  * Latencia de inferencia ultrarrápida (< 2 ms).
* **Interpretabilidad SHAP**:
  * Generación de los 3 factores principales que explican la probabilidad de mora.
* **Smart Fallback en BFF (`app/api/predict/route.ts`)**:
  * Si el microservicio Python está inactivo, el backend de Next.js calcula un score heurístico determinista calibrado, permitiendo que el Frontend funcione de forma ininterrumpida.

---

## 🗄️ 7. Base de Datos Relacional (Supabase PostgreSQL)

Esquema vigente versionado en `supabase/migrations/20260912150000_create_agent_schema.sql`:

1. **`clientes`**: Perfil socioeconómico, calendario de ingresos (quincenas, remesas), obligaciones de crédito, días de mora de la cuota más antigua y score predictivo.
2. **`conversaciones`**: Metadatos de la sesión, canal (`texto`/`voz`), modo de voz (`pipeline`/`s2s`/`NULL`), apertura (`agente`/`cliente`) y estado final.
3. **`turnos`**: Transcripción cronológica completa con latencia en milisegundos, consumo de tokens, resultado del validador y versión del modelo.
4. **`acuerdos`**: Registro formal del cierre: tipo de solución acordada, monto, fecha pactada o motivo documentado de no-acuerdo.

**Generador de Datos (`scripts/generate-seed.mjs`)**:
* Produce 308 perfiles: los 8 personajes héroes del pitch más 300 clientes sintéticos con distribución de señales realista y determinista.

---

## 🛡️ 8. Suites de Verificación y Control

* **`npm run verify:reglas`**: Suite de pruebas unitarias deterministas (23/23) sin dependencias externas; valida el cálculo de descalces, fechas sugeridas, elegibilidad de productos y rechazo de respuestas indebidas.
* **`npm run ataque`**: Batería de 20 ataques de estrés conversacional (plazos irreales, condonación indebida, bancos competidores, prompt injection).
* **`npm run demo:reset`**: Script de reinicio inmediato para limpiar el estado de la base de datos entre ensayos del pitch.
