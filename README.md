<p align="center">
  <img width="320" alt="Bancoagrícola Logo" src="https://github.com/user-attachments/assets/100ad7e5-cec7-4b56-9aaa-0c42c319ee1d" />
</p>

# Bancoagrícola — Prevención Empática de Mora Crediticia

> **El Reto:** *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."*

Este repositorio contiene la plataforma integral desarrollada para el **EntropyHack 2026**, combinando modelos predictivos de Machine Learning (detección temprana 15-45 días antes del vencimiento) con una experiencia de usuario empática inspirada en la identidad de **Banco Agrícola (Grupo Bancolombia)**.

---

## 🏛️ Arquitectura del Sistema

```
                              ┌────────────────────────────────────────┐
                              │     Bancoagrícola Web App (Next.js)    │
                              │   Tailwind + Shadcn + Brand Tokens     │
                              └──────────────────┬─────────────────────┘
                                                 │
            ┌────────────────────────────────────┼────────────────────────────────────┐
            │                                    │                                    │
    ┌───────▼────────┐                   ┌───────▼────────┐                   ┌───────▼────────┐
    │  BFF / APIs    │                   │   Supabase     │                   │   ML Service   │
    │ /api/predict   │                   │ PostgreSQL DB  │                   │ Python FastAPI │
    │ /api/health    │                   │ RLS Policies   │                   │ LightGBM/XGB   │
    └────────────────┘                   └────────────────┘                   └────────────────┘
```

* **Frontend & BFF**: Next.js 14 (App Router), TypeScript, Tailwind CSS con paleta oficial Bancoagrícola (`#003B71`, `#FDDA24`).
* **Machine Learning (`/ml`)**: Modelo de clasificación supervisada (LightGBM/XGBoost) entrenado en patrones de estrés crediticio (utilización, DTI, caída de ahorros) + Explicabilidad SHAP.
* **Base de Datos (`/supabase`)**: Esquema en PostgreSQL con Row-Level Security (RLS) para clientes, créditos, evaluaciones e intervenciones empáticas.
* **Agentes de IA (`AGENTS.md` & `.agents/skills`)**: Estandarización de código, seguridad fintech, salud de servicios y brand guidelines para el equipo de 4 personas.

---

## 🚀 Inicio Rápido (Onboarding en 3 minutos)

### 1. Clonar el repositorio y configurar variables de entorno
```bash
git clone https://github.com/romerokasl/agricola-entropyhack.git
cd agricola-entropyhack
cp .env.example .env.local
```

### 2. Levantar el Frontend (Next.js)
```bash
npm install
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### 3. Levantar el Módulo de Machine Learning (Opcional - Smart Fallback Activo)
*Nota: La aplicación cuenta con **Smart Fallback** en Next.js, por lo que el Frontend funciona al 100% incluso si no tienes Python instalado.*

Para entrenar o levantar la API real de inferencia:
```bash
cd ml
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
# Generar datos y entrenar:
python train.py --rows 50000
# Levantar microservicio FastAPI:
uvicorn api:app --reload --port 8000
```
Swagger UI disponible en [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🛡️ Habilidades y Reglas para Asistentes de IA

Este proyecto incluye directrices especializadas ubicadas en `.agents/skills/`:
* **`AGENTS.md`**: Guía global de desarrollo, convenciones de commit y prohibiciones para agentes de IA.
* **[backend](.agents/skills/backend/SKILL.md)**: Estándares para Route Handlers y Supabase.
* **[security](.agents/skills/security/SKILL.md)**: Protección de PII bancaria y RLS.
* **[health-checks](.agents/skills/health-checks/SKILL.md)**: Monitoreo de `/api/health` y `/health`.
* **[bancoagricola-ui](.agents/skills/bancoagricola-ui/SKILL.md)**: Tokens de color y UX empática.

---

## 🌿 Convención de Branches y Commits

### Commits Semánticos (Conventional Commits):
* `feat(scope): ...` — Nuevas funcionalidades.
* `fix(scope): ...` — Corrección de bugs.
* `ml(model): ...` — Cambios en modelos, datos o inferencia.
* `ui(brand): ...` — Ajustes de diseño o componentes visuales.
* `db(schema): ...` — Migraciones o esquemas SQL.

---

## 👥 Equipo EntropyHack 2026
* Banco Agrícola & Grupo Bancolombia — Reto de Prevención de Mora Crediticia.
