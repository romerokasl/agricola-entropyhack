# AGENTS.md — Directrices para Asistentes de IA y Equipo de Desarrollo

Este documento es el punto de referencia único y normativo para cualquier asistente de IA (Antigravity, Cursor, Claude Code, GitHub Copilot) y para los 4 integrantes del equipo durante el hackathon **Bancoagrícola EntropyHack 2026**.

---

## 1. Misión del Proyecto y Diferenciadores Oficiales

> **Plataforma**: **Anticipa Bancoagrícola** — Motor Predictivo, Cobranza Empática y Rentabilidad Activa.
>
> **Reto**: *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."*

La solución se sostiene sobre **tres pilares innegociables**:

1. **Precisión Auditable (Cumplimiento SSF)**:
   * Motor predictivo con valores explicables **SHAP**, garantizando predictibilidad 100% transparente y auditable ante la Superintendencia del Sistema Financiero (SSF) y la normativa NCB-022.
2. **Cobranza Empática y Accionable**:
   * Comprensión del contexto salvadoreño (quincena 15/30, remesas, ventana legal de buró de 10 días, red de 890+ corresponsales) sin amenazas ni coerción.
   * Mapeo automatizado a productos reales de Bancoagrícola mediante una escalera de 8 opciones gobernada por código duro.
3. **Rentabilidad Activa (Monetización Tier A)**:
   * Identificación automatizada de perfiles con deuda saldada o 0 días de atraso (**Tier A Prime**) para desplegar oportunidades de **cross-selling y up-selling** (Adelanto de Salario, Extrafinanciamiento limpio, upgrade de productos).

---

## 2. Arquitectura del Repositorio

```
agricola-entropyhack/
├── .agents/                    # Habilidades y runbooks para agentes de IA
│   └── skills/                 # shadcn, motion, backend, security, bancoagricola-ui
├── app/                        # Next.js 14 App Router
│   ├── api/
│   │   ├── chat/               # Orquestador del agente conversacional por turnos
│   │   ├── health/             # Health check probe del sistema
│   │   └── predict/            # Proxy de inferencia ML con Smart Fallback
│   ├── chat/[cliente]/         # Canal conversacional estilo WhatsApp (Outbound/Inbound)
│   ├── layout.tsx              # Shell corporativo Bancoagrícola
│   ├── page.tsx                # Página principal / acceso a demos y dashboard
│   └── globals.css             # Estilos globales y tokens CSS
├── lib/
│   ├── agent/                  # System prompt, escalera, validador determinista y tools
│   └── supabase.ts             # Cliente de Supabase con service role para Route Handlers
├── ml/                         # Módulo de Machine Learning (Python FastAPI)
│   ├── requirements.txt        # Dependencias de inferencia y explicabilidad (SHAP)
│   └── api.py                  # Microservicio FastAPI (< 2 ms)
├── supabase/
│   ├── migrations/             # Migraciones SQL versionadas (4 tablas activas)
│   └── seed.sql                # Dataset determinista (8 héroes + 300 sintéticos)
├── scripts/
│   ├── verificar-reglas.ts     # Suite de 23 verificaciones de reglas de negocio
│   ├── bateria-ataque.ts       # Batería de 20 ataques contra el agente
│   └── generate-seed.mjs       # Generador del dataset determinista
├── docs/                       # Contexto de negocio, normativas y diseño
├── tailwind.config.ts          # Tokens corporativos oficiales
└── AGENTS.md                   # Este documento normativo
```

---

## 3. Reglas de Oro para Asistentes de IA

1. **Fuente Primaria de Componentes UI: shadcn/ui**:
   * Todo componente visual o de interfaz de usuario DEBE construirse a partir de **shadcn/ui** como fuente primaria oficial (`.agents/skills/shadcn/`).
   * Para animaciones fluidas, utilizar **Motion** (`motion/react`, ver `.agents/skills/motion/`).
   * Iconos: Utilizar exclusivamente `lucide-react`.
   * Logos oficiales de Bancoagrícola: `/public/bancoagricola_blackfont_logo.svg` (fondo claro) y `/public/bancoagricola_whitefont_logo.svg` (fondo oscuro).
2. **NO Alucines Paquetes**: 
   * Frontend: Usa únicamente paquetes declarados en `package.json`. Usa `fetch` nativo (prohibido Axios).
   * ML: Usa únicamente las librerías de `ml/requirements.txt`.
3. **Tipado Estricto de TypeScript**:
   * Prohibido usar `any`. Define interfaces explícitas y esquemas de Zod para requests, responses y mutaciones de base de datos.
4. **Respeto a la Identidad Visual de Bancoagrícola**:
   * Utiliza las clases de Tailwind alineadas a los tokens oficiales:
     * Amarillo Corporativo: `#FDDA24` — **Únicamente como fondo de relleno** (botones o badges) con texto oscuro encima. **NUNCA como color de texto sobre blanco** (por contraste WCAG).
     * Texto Oscuro Grafito: `#2C2A29` (texto principal de lectura).
     * Tonos de tranquilidad: Verde esmeralda y ámbar suave.
     * **EL CLIENTE NUNCA VE ROJO.** El color rojo genera culpa, angustia y evasión; se reserva de forma estricta para consolas administrativas internas.
5. **El Scorer ML es Interno — El LLM Dialoga — El Código Decide**:
   * `/api/predict` aporta score numérico y los 3 factores SHAP para contextualizar. **Su salida nunca se le muestra cruda al cliente.**
   * El LLM adapta el tono, la empatía y la conversación (voseo salvadoreño natural, 2 a 3 frases por turno).
   * Las reglas duras (escalera de opciones, plazos máximos de 1 a 3 días o corte de quincena, condonación cero) están escritas en **código inmutable**, no en el prompt.
   * **El validador determinista corre en cada turno** antes de emitir cualquier texto al usuario.
6. **Seguridad y Secretos**:
   * `SUPABASE_SERVICE_ROLE_KEY` solo puede leerse en Route Handlers del servidor (`app/api/...`), jamás en Client Components (`'use client'`) ni con prefijo `NEXT_PUBLIC_`.
7. **Modo de Emergencia Offline (`lib/demo.ts`)**:
   * Es estrictamente un **"botón rojo" de respaldo** por si el Wi-Fi colapsa durante el pitch. El desarrollo principal siempre interactúa con la base de datos real y endpoints.

---

## 4. Estandarización de Git y Commits

### Formato de Commits (Conventional Commits)
```
<tipo>(<alcance opcional>): <descripción concisa en imperativo>
```

**Tipos válidos:**
* `feat`: Nueva funcionalidad de usuario (ej. `feat(agent): support inbound customer inquiries`)
* `fix`: Corrección de un error (ej. `fix(validator): prevent decimal numbers from counting as sentence breaks`)
* `ml`: Cambios en modelos, SHAP o inferencia (ej. `ml(model): add tree explainer feature importance`)
* `db`: Esquemas o migraciones de Supabase (ej. `db(schema): add constraint for voice modes`)
* `ui`: Ajustes visuales, diseño o tokens (ej. `ui(chat): add streaming message indicator`)
* `docs`: Cambios en documentación o contexto (ej. `docs(ncb022): document point-in-time classification`)
* `chore`: Mantenimiento de configuración, dependencias o CI (ej. `chore(ci): update workflow checks`)

---

## 5. Contrato de Inferencia de ML (`/api/predict`)

### Request a `/api/predict` (POST)
```json
{
  "customerId": "cust_12345",
  "monthlyIncome": 850.0,
  "debtToIncomeRatio": 0.42,
  "creditLineUtilization": 0.78,
  "savingsDropPct": 0.35,
  "latePaymentsLast6m": 1,
  "daysUntilNextPayment": 12
}
```

### Response de `/api/predict`
```json
{
  "success": true,
  "data": {
    "riskScore": 74,
    "riskBand": "MODERATE_HIGH",
    "defaultProbability": 0.74,
    "preventiveActionRecommended": "MOVER_A_QUINCENA",
    "topRiskFactors": [
      { "factor": "Utilización de línea de crédito alta (>75%)", "shapValue": 0.28 },
      { "factor": "Caída en saldo de ahorros en últimos 3 meses", "shapValue": 0.22 },
      { "factor": "Descalce entre fecha de pago y quincena", "shapValue": 0.15 }
    ]
  }
}
```
*(Nota: El backend y el agente conversacional toman estos factores para guiar la consulta de herramientas tipadas, sin exponer mensajes directos no validados).*
