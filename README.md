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
                                    │      /api/chat      │
                                    │  orquestador de     │
                                    │  un turno           │
                                    └──────────┬──────────┘
                                               │
        ┌──────────────────────┬───────────────┼───────────────┬──────────────────────┐
        │                      │               │               │                      │
┌───────▼────────┐   ┌─────────▼────────┐  ┌───▼──────────┐  ┌─▼──────────────┐  ┌────▼───────────┐
│  LLM (1 file)  │   │  Tools tipadas   │  │  Validador   │  │   Supabase     │  │   ML Service   │
│ lib/agent/llm  │   │  Zod → Postgres  │  │ determinista │  │ clientes ·     │  │ /api/predict   │
│ Gemini Flash   │   │  sin RAG         │  │ en cada turno│  │ conversaciones │  │ LightGBM/XGB   │
│                │   │                  │  │ ANTES de     │  │ turnos ·       │  │ (interno)      │
│                │   │                  │  │ mostrar      │  │ acuerdos · RLS │  │ SHAP values    │
└────────────────┘   └──────────────────┘  └──────────────┘  └────────────────┘  └────────────────┘
```

* **Agente Conversacional (`/lib/agent`)**: System prompt con voseo salvadoreño natural, escalera de 8 opciones y límites duros **en código** (no en el prompt), tools tipadas con Zod contra Postgres relacional (sin RAG: la información financiera bancaria es exacta y determinista) y **validador determinista que audita cada turno antes de responder**.
* **Frontend & Interfaz**: Next.js 14 (App Router), TypeScript estricto, Tailwind CSS. Interfaz estilo WhatsApp (recomendación expresa del banco). Tokens corporativos: amarillo `#FDDA24` (relleno, nunca texto) y grafito `#2C2A29`. **El cliente nunca ve rojo.**
* **Machine Learning (`/ml`)**: Modelo de clasificación supervisada (LightGBM/XGBoost) con interpretabilidad SHAP. **Es interno:** segmenta a quién contactar y enriquece el contexto del agente; sus textos crudos nunca se le exponen directamente al cliente.
* **Base de Datos (`/supabase`)**: PostgreSQL con Row-Level Security (RLS). Tablas principales: `clientes`, `conversaciones`, `turnos` (transcripción auditable) y `acuerdos` (resultado estructurado registrado).

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
| `/chat/karla` | ⭐ **Caso Estrella (Outbound):** Cobra el 15 y el 30, la cuota vence el 8. El agente detecta el descalce y ofrece mover la fecha al 16 a costo cero. |
| `/chat/karla?apertura=cliente` | **Caso Inbound:** La clienta inicia la conversación. El agente atiende su duda directa y consulta su perfil sin repetir preguntas innecesarias. |
| `/chat/marta` | **Caso de Control:** Devuelve `409 NO_CONTACTAR`. Demuestra que el sistema discrimina inteligentemente y no hostiga a clientes al día. |

### 2.3 Verificación de Reglas y Batería de Ataques
```bash
npm run verify:reglas   # verificación unitaria determinista (calendario, escalera, guardrails)
npm run ataque          # batería de 20 ataques contra el agente (resistencia en vivo)
npm run demo:reset      # resetea las conversaciones para dejar el demo limpio
```

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

---

## 👥 Equipo EntropyHack 2026
Banco Agrícola & Grupo Cibest / Bancolombia — Reto de Prevención de Mora Crediticia.
