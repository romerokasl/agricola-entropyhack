<p align="center">
  <img width="320" alt="Bancoagrícola Logo" src="https://github.com/user-attachments/assets/100ad7e5-cec7-4b56-9aaa-0c42c319ee1d" />
</p>

# Bancoagrícola — Prevención Empática de Mora Crediticia

> **El Reto:** *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."*

Este repositorio contiene la solución desarrollada para el **EntropyHack 2026**: un **agente conversacional de cobranza preventiva**. La conversación no es una función del producto — **es el producto**.

El flujo crítico es `conversar → comprender → adaptarse → negociar → cerrar → registrar`, y la tesis es simple: no es un cobrador, es una conversación que protege el récord crediticio de la persona. El pago llega como consecuencia de eso, nunca al revés.

Un modelo de Machine Learning decide **a quién** contactar y por qué; el agente decide **cómo** conversarlo, siempre dentro de reglas que viven en código.

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
│ Gemini Flash   │   │  sin RAG         │  │ en cada turno│  │ conversaciones │  │  modelo vivo + │
│                │   │                  │  │ ANTES de     │  │ turnos ·       │  │  lote + reglas │
│                │   │                  │  │ mostrar      │  │ acuerdos · RLS │  │  → ml/ FastAPI │
└────────────────┘   └──────────────────┘  └──────────────┘  └────────────────┘  └────────────────┘
```

* **Agente conversacional (`/lib/agent`)**: System prompt versionado, escalera de 8 opciones y límites de negociación **en código** (no en el prompt), tools tipadas con Zod contra Postgres (sin RAG: los datos financieros son deterministas) y un **validador determinista que corre en cada turno antes de mostrar cualquier respuesta**.
* **Frontend & BFF**: Next.js 14 (App Router), TypeScript, Tailwind CSS. Canal de texto estilo WhatsApp, según recomendó el banco. Tokens de marca: amarillo `#FDDA24` (relleno, nunca texto) y grafito `#282828`. **El cliente nunca ve rojo.**
* **Machine Learning (`/ml`)**: Modelo multiclase sobre las clases de atraso de la NCB-022 (LightGBM/XGBoost/CatBoost/RF, comparados con `StratifiedKFold`) + explicabilidad SHAP, servido por FastAPI con telemetría y detección de data drift.
* **Señal de riesgo (`/lib/riesgo`)**: la capa que conecta el modelo con la conversación. Combina **tres vistas** — el microservicio llamado en vivo, el score de lote de la fila y las reglas de calendario salvadoreño — y produce una señal por conversación que decide **a quién contactar y por dónde empezar**. Es **interna**: el servicio devuelve también mensajes ya redactados, y **esos textos se descartan a propósito** porque rompen los guardrails del banco. El modelo aporta la señal; las palabras las pone el agente. Detalle en [`docs/senal-de-riesgo.md`](docs/senal-de-riesgo.md).
* **Base de Datos (`/supabase`)**: PostgreSQL con RLS. Cuatro tablas — `clientes`, `conversaciones`, `turnos` y `acuerdos`. `turnos` es la transcripción y `acuerdos` el resultado registrado: las dos evidencias que pidió el banco. `conversaciones` guarda además la señal de riesgo y el motivo que abrieron la conversación, para que el registro pueda contestar *por qué* el sistema le habló a esa persona ese día.
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
npm ci
npm run dev
```
> Usar **`npm ci`**, no `npm install`: `install` reescribe el lockfile y genera conflictos entre las laptops del equipo.

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### 2.1 Aplicar el esquema y los datos

```bash
npm run db:migrate   # crea las 4 tablas
npm run seed:apply   # siembra 8 personajes + 300 clientes sintéticos
```

> Si `db:migrate` falla con `ENOTFOUND`, tu `DATABASE_URL` es la conexión **directa**, que hoy es solo IPv6. Usá la del **Session pooler** (Project Settings → Database → Connection string → Session pooler). Alternativa que siempre funciona: pegar los `.sql` en el SQL Editor del dashboard.

El dataset está generado por `scripts/dataset.mjs` y es determinista. Las tres formas de aplicarlo, en [`supabase/README.md`](supabase/README.md).

### 2.2 Probar la conversación

| URL | Qué muestra |
|---|---|
| `/chat/karla` | ⭐ El caso estrella: cobra el 15 y el 30, la cuota vence el 8. El agente detecta la desalineación y ofrece mover la fecha, sin costo. |
| `/chat/karla?apertura=cliente` | La persona escribe primero. El agente igual se presenta y no vuelve a preguntar lo que ya le dijeron. |
| `/chat/marta` | **El control.** Devuelve 409: el sistema se niega a abrir conversación con quien no hay por qué contactar. |

> **¿Qué funciona hoy?** Ver [`docs/estado-del-agente.md`](docs/estado-del-agente.md) — el estado verificado contra Supabase y Gemini reales, con la conversación de Karla completa y lo que falta.

### 2.3 Verificación

```bash
npm run verify:reglas   # lógica pura: calendario, escalera, validador y señal de riesgo (sin BD)
npm run riesgo:demo     # la señal de los 8 personajes, con sus tres vistas desglosadas
npm run ataque          # batería de 20 ataques contra el agente (requiere servidor y credenciales)
npm run demo:reset      # borra las conversaciones y deja el demo limpio
```

`npm run riesgo:demo` sirve para confirmar antes del pitch que el control (Marta) sigue
sin ser contactado y que el microservicio de `ml/` está aportando. Funciona con el
servicio levantado y sin él — la columna `vivo` sale vacía y el resto no cambia.

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
# Levantar microservicio FastAPI:
uvicorn api:app --reload --port 8000
```
> El artefacto entrenado (`model_abcd.pkl`) **no está versionado**: se genera con
> `python ml/train.py`. Sin él, `api:app` levanta igual y responde con su heurística
> interna, y la señal de riesgo lo registra como tal (`modeloVersion`). El flujo
> conversacional no depende de que el servicio esté arriba: ver
> [`docs/senal-de-riesgo.md`](docs/senal-de-riesgo.md).
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
