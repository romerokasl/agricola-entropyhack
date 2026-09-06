# AGENTS.md — Directrices para Asistentes de IA y Equipo de Desarrollo

Este documento es el punto de referencia único y normativo para cualquier asistente de IA (Antigravity, Cursor, Claude Code, GitHub Copilot) y para los 4 integrantes del equipo durante el hackathon **Bancoagrícola EntropyHack**.

---

## 1. Misión del Proyecto

> **Reto:** *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."*

* **El Core Técnico**: Modelo de ML preventivo (LightGBM/XGBoost) entrenado con 300k-500k registros que detecta patrones de estrés financiero 15-45 días antes de la fecha de corte.
* **La Experiencia (UX)**: Interfaz empática inspirada en la marca **Banco Agrícola (Grupo Bancolombia)** que ofrece soluciones oportunas (reestructuración sin penalización, diferimiento, asesoría financiera y micro-pagos) protegiendo el historial crediticio del salvadoreño.

---

## 2. Arquitectura del Repositorio (Monorepo Modular)

```
agricola-entropyhack/
├── .agents/                    # Habilidades y runbooks para agentes de IA
│   └── skills/
│       ├── backend/            # APIs, Next.js route handlers, Supabase
│       ├── security/           # PII, Fintech security, RLS, secretos
│       ├── health-checks/      # Endpoints /api/health y /health
│       └── bancoagricola-ui/   # Brand guidelines, tokens y UX empática
├── app/                        # Next.js 14+ App Router (Frontend + BFF)
│   ├── api/
│   │   ├── health/             # Health check probe del sistema
│   │   └── predict/            # Proxy de inferencia (con Smart Fallback)
│   ├── layout.tsx              # Shell corporativo con diseño Bancoagrícola
│   ├── page.tsx                # Dashboard de salud crediticia preventiva
│   └── globals.css             # Estilos globales y tokens CSS
├── ml/                         # Módulo de Machine Learning (Python)
│   ├── requirements.txt        # Dependencias de inferencia y ML (FastAPI, Scikit-Learn, etc.)
│   └── api.py                  # Microservicio FastAPI ultrarrápido (Inferencia + SHAP + Drift)
├── supabase/                   # Configuración y esquemas de base de datos
│   ├── migrations/             # Migraciones SQL versionadas
│   └── seed.sql                # Datos de prueba para el hackathon
├── .github/
│   └── workflows/
│       └── ci.yml              # CI/CD: typecheck, lint y verificación de build
├── tailwind.config.ts          # Tokens oficiales de color y diseño Bancoagrícola
├── vercel.json                 # Configuración de despliegue en Vercel
├── .env.example                # Plantilla documentada de variables de entorno
└── AGENTS.md                   # Este documento normativo
```

---

## 3. Reglas de Oro para Asistentes de IA

1. **Fuente Primaria de Componentes UI: shadcn/ui**:
   * Todo componente visual o de interfaz de usuario DEBE construirse a partir de **shadcn/ui** como fuente primaria oficial (`.agents/skills/shadcn/`).
   * Para animaciones e interactividad fluida, utilizar **Motion** (`motion/react`, ver `.agents/skills/motion/`).
   * Iconos: Utilizar exclusivamente `lucide-react`.
   * Logos oficiales de Bancoagrícola: ubicados en `/public/bancoagricola_blackfont_logo.svg` (fondo claro) y `/public/bancoagricola_whitefont_logo.svg` (fondo oscuro).
2. **NO Alucines Paquetes**: 
   * Frontend: Usa únicamente paquetes declarados. No agregues Axios (usa `fetch` nativo).
   * ML: Usa únicamente las librerías de `ml/requirements.txt`.
3. **Tipado Estricto de TypeScript**:
   * Prohibido usar `any`. Define interfaces explícitas para todos los modelos de datos, requests y responses.
   * Corre `npm run type-check` mentalmente o verifica que el código compile sin advertencias de tipos.
4. **Respeto a la Identidad Visual de Bancoagrícola**:
   * Utiliza las clases de Tailwind con prefijo `agricola-` (`bg-agricola-blue`, `bg-agricola-yellow`, `text-agricola-dark`, `bg-agricola-bg`).
   * Nunca uses negro puro `#000000` para texto de lectura; usa `text-agricola-dark` (`#282828`).
   * Mantén sombras sutiles (`shadow-subtle`) y bordes limpios con generoso espacio blanco.
5. **Tono Empático Obligatorio**:
   * Ningún texto en la interfaz debe sonar a cobro judicial o intimidación.
   * Utiliza términos como *"Cuidemos tu récord crediticio"*, *"Opciones a tu medida"*, *"Alivio financiero"*, *"Propuesta preventiva"*.
6. **Seguridad y Secretos**:
   * **NUNCA** incluyas claves privadas en código cliente o commits.
   * `SUPABASE_SERVICE_ROLE_KEY` solo puede leerse en Route Handlers del servidor (`/app/api/...`), jamás en Client Components (`'use client'`).

---

## 4. Estandarización de Git y Commits

### Formato de Commits (Conventional Commits)
Todo commit realizado tanto por humanos como por agentes de IA DEBE seguir esta estructura:

```
<tipo>(<alcance opcional>): <descripción concisa en imperativo>
```

**Tipos válidos:**
* `feat`: Nueva funcionalidad de usuario (ej. `feat(ui): add empathetic payment restructuring modal`)
* `fix`: Corrección de un error (ej. `fix(api): handle timeout when calling ML inference`)
* `ml`: Cambios en modelos, pipelines o datos (ej. `ml(model): train lightgbm on 300k synthetic records with SHAP`)
* `db`: Esquemas, migraciones o seeds de Supabase (ej. `db(schema): add risk_assessments table with RLS`)
* `ui`: Ajustes visuales, diseño o tokens de marca (ej. `ui(brand): align button styles with bancoagricola palette`)
* `security`: Ajustes de permisos, enmascaramiento de PII o validaciones (ej. `security: mask customer account numbers in logs`)
* `chore`: Mantenimiento de configuración, dependencias o CI (ej. `chore(ci): add type-check step to pull requests`)

### Convención de Branches (Para cuando se creen ramas)
* `feat/<nombre-funcionalidad>` (ej. `feat/financial-health-card`)
* `ml/<nombre-modelo-o-tarea>` (ej. `ml/xgboost-pipeline`)
* `db/<cambio-esquema>` (ej. `db/interventions-table`)
* `fix/<descripcion-bug>` (ej. `fix/api-health-cors`)

---

## 5. Contrato de Inferencia de ML (Frontend ↔ Backend ↔ ML Service)

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
    "riskScore": 74, // 0 a 100
    "riskLevel": "MODERATE_HIGH", // "LOW" | "MODERATE" | "MODERATE_HIGH" | "CRITICAL"
    "defaultProbability": 0.74,
    "preventiveActionRecommended": "PAYMENT_RESTRUCTURING",
    "topRiskFactors": [
      { "factor": "Utilización de línea de crédito alta (>75%)", "impact": "+28%" },
      { "factor": "Caída en saldo de ahorros en últimos 3 meses", "impact": "+22%" },
      { "factor": "Ratio deuda/ingreso superior al umbral óptimo", "impact": "+15%" }
    ],
    "empatheticMessage": "Notamos que este mes tus gastos han aumentado. Queremos cuidar tu récord crediticio con opciones flexibles antes de tu fecha de pago."
  }
}
```
