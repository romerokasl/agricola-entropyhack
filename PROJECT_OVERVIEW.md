# Inventario Completo del Repositorio — Bancoagrícola EntropyHack

Este documento resume todos los componentes, herramientas, automatizaciones y estándares configurados en el repositorio para el equipo de 4 personas.

---

## 📋 1. Gobernanza y Directrices (`AGENTS.md`)
Ubicación: `AGENTS.md`

* **Propósito**: Punto de referencia único y normativo tanto para los 4 integrantes del equipo como para cualquier asistente de IA (Antigravity, Cursor, Claude Code, Copilot).
* **Regla Primaria de UI**: Se estableció formalmente **`shadcn/ui` como la fuente primaria oficial** para todos los componentes de interfaz de usuario.
* **Reglas Anti-Alucinación**: Prohibición estricta de instalar paquetes innecesarios (como Axios, usando `fetch` nativo) o librerías fuera de `package.json` y `ml/requirements.txt`.
* **Tipado Estricto**: Prohibición de uso de `any` en TypeScript; tipado explícito para requests, responses y modelos de datos.
* **Conventional Commits**: Estandarización obligatoria de commits (`feat:`, `fix:`, `ml:`, `db:`, `ui:`, `security:`, `chore:`).
* **Estrategia de Branches**: Prefijos definidos para el trabajo en equipo (`feat/...`, `ml/...`, `db/...`, `fix/...`).
* **Seguridad Bancaria**: Aislamiento total de claves administrativas (`SUPABASE_SERVICE_ROLE_KEY` exclusiva en Server Components / Route Handlers, jamás en el cliente).
* **Contrato de Inferencia**: Especificación estricta de payloads para `/api/predict`.

---

## 🤖 2. Habilidades Especializadas para Agentes de IA (`.agents/skills/`)

Directrices que los asistentes de IA cargan bajo demanda para mantener consistencia:

1. **`shadcn`**:
   * Instalada mediante `npx skills add shadcn/ui`.
   * Provee reglas de composición, instalación de componentes vía CLI, configuración de `components.json` y registries.
2. **`migrate-radix-to-base`**:
   * Reglas de migración y adaptación de primitivas de Radix UI a Base UI.
3. **`motion`** (`.agents/skills/motion/SKILL.md`):
   * Guía completa de animación con la nueva biblioteca oficial **Motion** (`motion/react` de [motion.dev](https://motion.dev)).
   * Transiciones aceleradas por GPU (`transform`, `opacity`), resortes físicos (`spring`), `AnimatePresence` y animaciones de layout compartidas (`layoutId`).
4. **`backend`** (`.agents/skills/backend/SKILL.md`):
   * Estándares para Route Handlers en Next.js App Router, respuestas JSON unificadas (`success`, `data`, `error`), validación en frontera con Zod y clientes de Supabase.
5. **`security`** (`.agents/skills/security/SKILL.md`):
   * Protocolos de seguridad fintech, enmascaramiento de PII bancaria (números de cuenta, tarjetas, DUI salvadoreño), sanitización de logs y Row-Level Security (RLS).
6. **`health-checks`** (`.agents/skills/health-checks/SKILL.md`):
   * Estándar de monitoreo de dependencias, cálculo de latencias y especificación de endpoints de salud.
7. **`bancoagricola-ui`** (`.agents/skills/bancoagricola-ui/SKILL.md`):
   * Identidad de marca de Banco Agrícola (Grupo Bancolombia), psicología del color, tono empático y principios de UX anti-cobranza hostil.

---

## 🎨 3. Frontend y Branding (Next.js 14 + Tailwind)

* **Página de Lanzamiento ("Coming...")**:
  * `app/page.tsx`: Interfaz minimalista con fondo negro `#000` y texto centrado `"Coming..."` con tipografía limpia y espaciada.
  * `app/layout.tsx`: Shell limpio en fondo negro sin elementos distractores.
  * `app/globals.css`: Estilos base con fondo negro por defecto.
* **Tokens de Diseño de Bancoagrícola**:
  * `tailwind.config.ts`: Paleta corporativa con prefijo `agricola-`:
    * Azul Corporativo: `#003B71` (`agricola-blue`)
    * Amarillo / Dorado: `#FDDA24` (`agricola-yellow`)
    * Texto Oscuro Suave: `#282828` (`agricola-dark`)
    * Fondos Secundarios: `#F8F8F8` y `#F4F4F4` (`agricola-bg`)
    * Semáforo Preventivo: Verde (`#28A745`), Ámbar (`#E0A800`), Alerta Suave (`#DC3545`).
* **Logos Oficiales en `public/`**:
  * `public/bancoagricola_blackfont_logo.svg`: Logo para fondos claros.
  * `public/bancoagricola_whitefont_logo.svg`: Logo para fondos oscuros.
* **Paleta CSS de Referencia**:
  * `Color_Palette.css`: Variables CSS extraídas de la web oficial de Bancoagrícola.

---

## ⚡ 4. Backend y APIs (BFF)

* **Endpoint de Diagnóstico en Vivo**:
  * `app/api/health/route.ts`: Monitorea en tiempo real el runtime de Next.js, la conexión con Supabase y la disponibilidad del microservicio de ML.
* **Proxy de Predicción con Smart Fallback**:
  * `app/api/predict/route.ts`: 
    * Valida datos entrantes con esquemas estrictos de **Zod**.
    * Intenta invocar el servicio FastAPI en Python.
    * **Smart Fallback**: Si el servicio Python no está encendido, calcula un score heurístico determinista y factores de riesgo para que los desarrolladores de Frontend **nunca se queden bloqueados**.
* **Cliente de Base de Datos**:
  * `lib/supabase.ts`: Exporta el cliente público (`supabase`) y la función administrativa para el servidor (`getSupabaseAdmin`).

---

## 🧠 5. Módulo de Machine Learning & MLOps (`ml/`)

* **Dependencias**:
  * `ml/requirements.txt`: `lightgbm`, `xgboost`, `scikit-learn`, `shap`, `fastapi`, `uvicorn`, `pydantic`.
* **Inferencia y Monitoreo**:
  * `ml/api.py`: Microservicio FastAPI ultrarrápido (< 2 ms) con Swagger UI en `/docs`, `/health` y `POST /predict` para servir el modelo entrenado externamente por el equipo.
  * Preparado para diseño de monitoreo de **Data Drift** (PSI / distribución de features de entrada) y alertas de re-entrenamiento.
* **Guía de Ejecución**:
  * `ml/README.md`: Documentación de ejecución y despliegue del microservicio.


---

## 🗄️ 6. Base de Datos (Supabase)

* **Esquema Inicial con RLS e Índices**:
  * `supabase/migrations/20260906000000_initial_schema.sql`:
    1. `customers`: Perfil básico y antigüedad del cliente.
    2. `credit_accounts`: Tarjetas y préstamos activos con saldos y fechas de corte.
    3. `financial_metrics`: Variables para el modelo (ingreso mensual, DTI, utilización, caída de ahorros).
    4. `risk_assessments`: Evaluaciones del modelo, score 0-100 y factores explicativos SHAP en formato JSONB.
    5. `empathic_interventions`: Registro de planes ofrecidos (fraccionamiento, readecuación) y respuestas del usuario.
* **Datos de Prueba**:
  * `supabase/seed.sql`: 2 perfiles salvadoreños completos de prueba (Carlos en riesgo moderado-alto vs Ana con perfil saludable).
* **Variables de Entorno Locales**:
  * `.env.local`: Configurado con el Project ID `zepewgqjqbcnfsmbqsad` y la URL `https://zepewgqjqbcnfsmbqsad.supabase.co`.
  * `.env.example`: Plantilla documentada para nuevos compañeros.

---

## 🚀 7. CI/CD Automatizado y Calidad de Código

* **Pipeline de GitHub Actions**:
  * `.github/workflows/ci.yml`:
    * Se dispara automáticamente en cada **Pull Request** y **Push a `main`**.
    * **Job 1 (Frontend)**: Verifica tipos de TypeScript (`tsc --noEmit`), corre linter (`npm run lint`) y valida la compilación (`npm run build`).
    * **Job 2 (Machine Learning)**: Valida sintaxis estática y dependencias de Python (`py_compile`).
* **Configuración de Linter no interactiva**:
  * `.eslintrc.json`: Integra `next/core-web-vitals` previniendo que Next.js lance prompts interactivos que puedan romper el runner de GitHub Actions.
* **Despliegue en Vercel**:
  * `vercel.json`: Configurado para despliegue nativo de Next.js.
* **Seguridad del Repositorio**:
  * `.gitignore`: Protegido contra commits accidentales de `.env`, `.env*.local`, `node_modules`, `.next/`, binarios de ML (`.joblib`, `.pkl`) o datasets sintéticos pesados.
