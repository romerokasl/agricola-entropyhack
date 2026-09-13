<p align="center">
  <img width="320" alt="Bancoagrícola Logo" src="https://github.com/user-attachments/assets/100ad7e5-cec7-4b56-9aaa-0c42c319ee1d" />
</p>

# Anticipa Bancoagrícola — Motor Predictivo, Cobranza Empática y Rentabilidad Activa

> **El Reto:** *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."* — **EntropyHack 2026**

**Anticipa Bancoagrícola** es una plataforma integral que redefine la gestión crediticia y la interacción con el cliente. Combina un **motor de Machine Learning auditable (SHAP)** con un **agente conversacional empático** guiado por reglas deterministas y cumplimiento estricto de la normativa de la **Superintendencia del Sistema Financiero (SSF)**. 

No solo prevenimos el deterioro del récord crediticio: **transformamos la prevención en rentabilidad activa**.

---

## 🌟 Tres Diferenciadores Clave

1. **Precisión Auditable (Cumplimiento SSF):**
   * Motor predictivo entrenado con variables de comportamiento financiero real de la industria salvadoreña (antigüedad, utilización de línea, caída de ahorros a 3 meses, descalces de liquidez).
   * Explicabilidad matemática mediante valores **SHAP** (`shap.TreeExplainer`), garantizando que cada score, probabilidad de impago y motivo de contacto sea **100% transparente, auditable y alineado a la normativa NCB-022**.
2. **Cobranza Empática y Accionable:**
   * La IA comprende el contexto real del deudor salvadoreño (fechas de quincena 15/30, ciclos de remesas, ventana legal de buró de 10 días, red física de 890+ corresponsales) sin amenazar ni culpabilizar.
   * Mapea automáticamente la situación del cliente a **productos y soluciones reales de Bancoagrícola** mediante una escalera de 8 escalones de menor a mayor costo, respetando restricciones duras de negocio en código.
3. **Rentabilidad Activa (Monetización Tier A):**
   * No solo mitigamos pérdidas y liberamos reservas de saneamiento; **multiplicamos los ingresos del banco**.
   * Identificamos de forma automatizada a clientes con historial impecable (**Tier A Prime**) y detonamos oportunidades oportunas de **cross-selling y up-selling** sin fricción (Adelanto de Salario, Extrafinanciamiento limpio, ampliación de líneas), convirtiendo la prevención en crecimiento comercial.

---

## 🔄 Pipeline de la Aplicación

El sistema opera bajo dos modalidades complementarias: **Outbound (Proactivo)** e **Inbound (Receptivo)**.

```
                               ANTICIPA BANCOAGRÍCOLA
                                          │
         ┌────────────────────────────────┴────────────────────────────────┐
         │                                                                 │
  [FLUJO OUTBOUND]                                                  [FLUJO INBOUND]
(El banco contacta)                                               (El cliente contacta)
         │                                                                 │
  Batch Diario 03:00 AM                                             Recepción Omnicanal
  + Inferencia ML (SHAP)                                            (WhatsApp / Web / Voz)
         │                                                                 │
┌────────┴────────┐                                                 Consulta Inmediata BD:
│ ¿Cuota saldada? │                                                 - Score y SHAP actual
└────────┬────────┘                                                 - Clasificación NCB-022
   SÍ    │    NO                                                    - Perfil financiero
┌────────▼────────┐                                                        │
│  TIER A PRIME   │                                                 Enfoque: Atender la
│ Bypass cobranza │                                                 necesidad del cliente
│ Ofertas activas │                                                        │
│ Cross/Up-sell   │                                                 Consulta Reglas de Negocio
└─────────────────┘                                                 y Opciones Elegibles
         │                                                                 │
   Evalúa mora y                                                    Negociación / Solución
   días de atraso:                                                  o Escalamiento a Humano
         │
 ┌───────┼──────────────────────────────┬───────────────────────────┐
 │       │                              │                           │
 ▼       ▼                              ▼                           ▼
TIER A (0-14 d)              TIER B y C (14-31 d y 32-120 d)     TIER D-E+ (120-365+ d)
- Cuota al día o gracia       - Recordatorio digital prioritario  - Recordatorio formal
- Oferta comercial /          - Agente Conversacional Empático    - Menor esfuerzo bot
  Alineación de quincena      - Negociación escalonada            - Derivación rápida
                                (Restricciones duras del banco)     a Ejecutivo Humano
```

### Segmentación Operativa y Acciones por Tier

| Segmento | Días de Atraso / Condición | Clasificación SSF (NCB-022) | Estrategia y Acciones Principales |
|---|---|---|---|
| **Tier A Prime** | Cuota saldada / 0 días de mora | Categoría A1 (0% a 1% reserva) | **Bypass total de cobranza.** Disparo activo de **Cross-selling y Up-selling** (Adelanto de Salario, Extrafinanciamiento, upgrade de tarjeta). |
| **Tier A Preventivo** | 0 a 14 días (o vencimiento inminente) | Categoría A1 / A2 (1% reserva) | Recordatorio amigable de bajo costo, alineación de fecha de pago a quincena o activación de débito automático. |
| **Tier B** | 14 a 31 días de atraso | Categoría A2 / B (1% a 5% reserva) | **Recordatorio prioritario (T-3 / T-1).** Agente conversacional empático: detección de causas, propuesta de abono parcial o pago fraccionado. |
| **Tier C** | 32 a 120 días de atraso | Categoría B / C1 / C2 (5% a 30% reserva) | Negociación estructurada de alivio financiero dentro de límites del banco. Evitar reclasificación severa y proteger provisiones. |
| **Tier D-E+** | 120 a 365+ días de atraso | Categoría D1 / D2 / E (50% a 100% reserva) | Recordatorio formal. **Menor resistencia del agente conversacional:** derivación rápida y prioritaria a ejecutivo humano para atención personalizada o cobranza especializada. |

---

## 🏛️ Arquitectura del Sistema

```
                        ┌──────────────────────────────────────────────┐
                        │   Canal tipo WhatsApp (Next.js App Router)   │
                        │        /chat/[cliente]  ·  Brand tokens       │
                        └──────────────────────┬───────────────────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  lib/agent/sesion   │
                                    │  la conversación,   │
                                    │  sin canal          │
                                    │  (texto y voz usan  │
                                    │   estas 2 funciones)│
                                    └──────────┬──────────┘
                                               │
        ┌──────────────────────┬───────────────┼───────────────┬──────────────────────┐
        │                      │               │               │                      │
┌───────▼────────┐   ┌─────────▼────────┐  ┌───▼──────────┐  ┌─▼──────────────┐  ┌────▼───────────┐
│  LLM (1 file)  │   │  Tools tipadas   │  │  Validador   │  │   Supabase     │  │  Señal riesgo  │
│ lib/agent/llm  │   │  Zod → Postgres  │  │ determinista │  │ clientes ·     │  │  lib/riesgo    │
│ Gemini Flash   │   │  sin RAG         │  │ en cada turno│  │ conversaciones │  │  modelo vivo · │
│                │   │                  │  │ ANTES de     │  │ turnos ·       │  │  lote · reglas │
│                │   │                  │  │ mostrar      │  │ acuerdos · RLS │  │  → ml/ FastAPI │
└────────────────┘   └──────────────────┘  └──────────────┘  └────────────────┘  └────────────────┘
```

* **Agente Conversacional (`/lib/agent`)**: System prompt con voseo salvadoreño natural, escalera de 8 opciones y límites duros **en código** (no en el prompt), tools tipadas con Zod contra Postgres relacional (sin RAG: la información financiera bancaria es exacta y determinista) y **validador determinista que audita cada turno antes de responder**.
* **Frontend & Interfaz**: Next.js 14 (App Router), TypeScript estricto, Tailwind CSS. Interfaz estilo WhatsApp (recomendación expresa del banco). Tokens corporativos: amarillo `#FDDA24` (relleno, nunca texto) y grafito `#2C2A29`. **El cliente nunca ve rojo.**
* **Machine Learning (`/ml`)**: Modelo multiclase sobre las clases de atraso de la NCB-022 (LightGBM/XGBoost/CatBoost/Random Forest, comparados con `StratifiedKFold`) con interpretabilidad SHAP, servido por FastAPI con telemetría y detección de data drift.
* **Señal de Riesgo (`/lib/riesgo`)**: la capa que conecta el modelo con la conversación. Combina **tres vistas** del cliente — el microservicio llamado en vivo, el score de lote de su fila y las reglas de calendario salvadoreño — y produce una señal por conversación que decide **a quién contactar y por dónde empezar**. **Es interna:** el servicio devuelve además mensajes ya redactados, y **esos textos se descartan a propósito** porque rompen los guardrails del banco. El modelo aporta la señal; las palabras las pone el agente. Detalle en [`docs/senal-de-riesgo.md`](docs/senal-de-riesgo.md).
* **Base de Datos (`/supabase`)**: PostgreSQL con Row-Level Security (RLS). Tablas principales: `clientes`, `conversaciones`, `turnos` (transcripción auditable) y `acuerdos` (resultado estructurado registrado). `conversaciones` guarda además la señal de riesgo y el motivo que abrieron la gestión, para que el registro pueda contestar *por qué* el sistema le habló a esa persona ese día.

---

## 🚀 Inicio Rápido

### 1. Clonar el repositorio y configurar entorno
```bash
git clone https://github.com/romerokasl/agricola-entropyhack.git
cd agricola-entropyhack
cp .env.example .env.local
```

### 2. Levantar el Frontend (Next.js)
```bash
npm ci
npm run dev
```
> Usar **`npm ci`**, no `npm install`, para preservar la integridad del lockfile entre las máquinas del equipo.

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### 2.1 Aplicar esquema y datos de prueba
```bash
npm run db:migrate   # aplica migraciones en Supabase
npm run seed:apply   # siembra 8 personajes del demo + 300 clientes sintéticos
```

### 2.2 Probar el Agente Conversacional

| URL | Demostración |
|---|---|
| `/chat/karla` | ⭐ El caso estrella: cobra el 15 y el 30, la cuota vence el 8. El agente detecta la desalineación y ofrece mover la fecha, sin costo. |
| `/chat/karla?apertura=cliente` | La persona escribe primero. El agente igual se presenta y no vuelve a preguntar lo que ya le dijeron. |
| `/chat/marta` | **El control.** Devuelve 409: el sistema se niega a abrir conversación con quien no hay por qué contactar. |

> **¿Qué funciona hoy?** Ver [`docs/estado-del-agente.md`](docs/estado-del-agente.md) — el estado verificado contra Supabase y Gemini reales, con la conversación de Karla completa y lo que falta.

### 2.2 bis · El canal de WhatsApp — `/demo/whatsapp`

Réplica del canal tal como lo ve la persona, con la consola interna del banco al lado.
**No necesita Supabase, ni Gemini, ni red:** corre sobre un guion en
[`lib/demo/guion-whatsapp.ts`](lib/demo/guion-whatsapp.ts), así que sirve como respaldo
si el demo en vivo falla.

Cubre los tipos reales de la **WhatsApp Business Cloud API** — plantilla `utility` (el
disparador fuera de la ventana de 24 h), botones de respuesta, mensaje de lista,
`cta_url`, **WhatsApp Flow** (formulario nativo), encuesta, ubicación, documento, nota de
voz, tarjeta de contacto, reacciones, cita y checks de entrega.

| Escenario | Qué prueba |
|---|---|
| **Karla** | ⭐ Desalineación de quincena. Plantilla → encuesta → Flow → constancia. Escalón 2, costo $0. |
| **Wilber** | Atrasado dentro de la ventana de buró. El agente **sube de escalón** cuando dice que no tiene saldo. |
| **Rosa** | **Entrante:** ella escribe primero y pide ver opciones → mensaje de lista. |
| **Marta** | **El control.** Hilo vacío: el sistema decide no contactarla. |

Dos interruptores en la barra de control:

- **Modo manual** — el guion se detiene en cada mensaje interactivo y espera el toque.
  Es el modo para presentar en vivo. Apagado, se reproduce solo.
- **Modo inspección** — etiqueta cada burbuja con su tipo de la Cloud API.

Escribir cualquier cosa en la barra del teléfono dispara la **respuesta segura**: el
agente no improvisa datos, ofrece un humano y la conversación no avanza.
### 2.3 Verificación de Reglas y Batería de Ataques
```bash
npm run verify:reglas   # verificación unitaria determinista (calendario, escalera, guardrails, señal de riesgo)
npm run riesgo:demo     # la señal de los 8 personajes, con sus tres vistas desglosadas
npm run ataque          # batería de 20 ataques contra el agente (resistencia en vivo)
npm run demo:reset      # resetea las conversaciones para dejar el demo limpio
```

`npm run riesgo:demo` confirma antes del pitch, sin abrir una conversación, que el caso
de control (Marta) sigue fuera del conjunto de contacto y si el microservicio de `ml/`
está aportando. Corre con el servicio levantado y sin él: la columna `vivo` sale vacía
y el resto no cambia.

### 3. Servicio de Machine Learning (Opcional - Smart Fallback Activo)
El BFF cuenta con **Smart Fallback determinista**, por lo que la aplicación corre al 100% incluso si el microservicio Python no está activo.

Para levantar el servicio de ML con FastAPI:
```bash
cd ml
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
uvicorn api:app --reload --port 8000
```
Swagger UI interactivo en [http://localhost:8000/docs](http://localhost:8000/docs).

> El artefacto entrenado (`model_abcd.pkl`) **no está versionado**: se genera con
> `python ml/train.py`. Sin él, `api:app` levanta igual y responde con su heurística
> interna, y la señal de riesgo lo registra como tal en `modeloVersion`. El flujo
> conversacional no depende de que el servicio esté arriba — ver
> [`docs/senal-de-riesgo.md`](docs/senal-de-riesgo.md).

---

## 👥 Equipo EntropyHack 2026
Banco Agrícola & Grupo Cibest / Bancolombia — Reto de Prevención de Mora Crediticia.
