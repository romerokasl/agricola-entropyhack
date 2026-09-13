# Auditoría final del repositorio

> Rama `Audit`, **13 de septiembre de 2026**, antes de la entrega del hackathon. Todo lo que dice
> "pasa" se corrió de verdad en Windows 11 (Node 24.18, npm 11.16 y npm 10 vía `npx`, Python 3.13).
> La auditoría se recortó por el plazo de entrega de las 10:00: lo que no alcanzó está en §4.

## 🚨 Acción humana urgente

**La clave `service_role` de Supabase del proyecto quedó publicada.** Estaba escrita en
`scripts/seed-supabase.js` desde el commit `491b587` (13 sep 2026), y el repo
`romerokasl/agricola-entropyhack` es **público**. Esa clave se salta el RLS: permite leer y borrar
toda la base. Los scripts `check-supabase.js` y `run-seed-remote.js` tenían la clave `anon`.

Ya se quitaron del árbol de trabajo, pero **siguen en el historial de git**. Hay que:

1. **Rotar la clave `service_role`** (y de paso la `anon`) en Supabase → Project Settings → API.
   Actualizar `.env.local` en las máquinas del equipo y las variables de Vercel.
2. Decidir si se limpia el historial (`git filter-repo` o BFG más force push). **No se hizo**: el
   prompt prohíbe reescribir el historial, y con la clave rotada deja de ser urgente.

---

## 1. Línea base vs. final

| Comando | Línea base (antes de tocar nada) | Final |
|---|---|---|
| `npm ci` | ❌ **Falla** en npm 11 y en npm 10: `Missing: @emnapi/core@1.11.3, @emnapi/runtime@1.11.3 from lock file` | ✅ Pasa con npm 10 (43 s) y en `--dry-run` con npm 11 |
| `npm run type-check` | ❌ 25+ errores `TS2307` (con el `node_modules` viejo: faltaban `motion`, Radix, `msedge-tts`, `@google-cloud/text-to-speech`) | ✅ Pasa |
| `npm run lint` | ✅ Pasa con 5 warnings (3 `<img>`, 2 `exhaustive-deps` en `LlamadaVoz.tsx`) | ✅ Igual |
| `npm run build` | ❌ `Module not found: Can't resolve 'motion/react'` | ✅ Pasa (95 s) |
| `npm run verify:reglas` | ✅ 53/53 | ✅ 53/53 |
| `npm run verify:dashboard` | ✅ 23/23 | ✅ 23/23 |
| `npm run verify:s2s` | ✅ 26/26 | ✅ 26/26 |
| `flake8 ml` (el mismo comando de la CI) | ✅ 0 errores | ✅ 0 errores |
| `python -m py_compile ml/api.py` | ✅ Pasa | ✅ Pasa |
| `python ml/test_service.py` | ❌ Falla en la prueba 1: `/health` no devuelve `status: ok` | ❌ Sin cambios (ver §4) |

**Causa raíz de la línea base roja:** el lockfile no estaba sincronizado con `package.json`. La CI
lo tapaba con `npm ci || npm install`, que en la práctica instalaba otra cosa distinta a la del lockfile.

## 2. Seguridad

| Hallazgo | Estado |
|---|---|
| JWT `service_role` hardcodeado en `scripts/seed-supabase.js` | ✅ Quitado del árbol. ⚠️ **Rotar la clave** (acción humana) |
| JWT `anon` y ref del proyecto hardcodeados en `scripts/check-supabase.js` y `scripts/run-seed-remote.js` | ✅ Quitados. Los tres scripts leen variables de entorno y fallan con un mensaje claro si faltan (verificado) |
| Otros secretos (JWT, `AIza…`, `sk-…`, `ghp_…`, llaves privadas PEM, `postgres://user:pass@`, AWS) en 207 archivos versionados y no ignorados | ✅ Ninguno |
| `SUPABASE_SERVICE_ROLE_KEY` o credenciales de Google en componentes `'use client'` | ✅ Ninguno |
| Rutas de `app/api` que devolvían `e.message` crudo en los 500 (`chat`, `dashboard`, `dashboard/conversaciones/[id]`, `predict`, `voz`, `voz-s2s`, `monitoring`) | ✅ Corregido: el error se loguea en el servidor con `console.error` y el cliente recibe un mensaje genérico. Los errores esperados (`ErrorSesion`, `ErrorS2S`) conservan su mensaje. Después del cambio pasan type-check, lint, build y los tres verify |
| `POST /api/monitoring` no valida el body con Zod (`scenario`, `count` sin límite) | ⚠️ Pendiente |
| `.env.example` no listaba `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`, `DEMO_MODE`, `OPENAI_*`, `PIPER_*`, `WHISPER_*` | ✅ Agregadas. `BASE_URL` y `CANAL` son solo de `npm run ataque` y no van al `.env` |

## 3. Qué se borró o movió

| Archivo | Acción | Por qué |
|---|---|---|
| `metricas-mostradas-dashboard.md` (raíz) | Borrado | Idéntico byte a byte a `docs/metricas-mostradas-dashboard.md` |
| `dashboard-contrato.md` (raíz) | Borrado | Versión vieja del de `docs/`, que la contiene entera y suma 21 líneas. El código referencia la de `docs/` |
| PDFs del reto, `Koala (…) pitch….txt`, `investigacion.md`, `CLIENTES_LOCALHOST.md`, `PROJECT_OVERVIEW.md`, `Color_Palette.css` | Movidos a `docs/referencia/` | Material de referencia sin referencias desde el código ni desde los docs |
| `UML.md` | **Se quedó en la raíz** | Lo referencian `supabase/README.md`, `docs/contexto/05-productos-y-ncb022.md` y un comentario de la migración base |

## 4. Lo que no se pudo verificar o no se alcanzó

| Qué | Por qué |
|---|---|
| Rutas de la app (`/chat/karla`, `/chat/marta` 409, `/dashboard`, `/demo/whatsapp`, `/voz`, `/s2s`, `/api/health`, `/api/predict` con y sin ML) | **No verificado.** No hay `.env.local` en la máquina de la auditoría (sin Supabase ni LLM) y no alcanzó el tiempo. El build de producción sí compila todas las rutas |
| `npm run db:migrate`, `npm run seed:apply` | No verificado: requieren credenciales de Supabase |
| Determinismo de `npm run seed:generate` | No alcanzó el tiempo |
| `npm run ataque` | No se corrió a propósito: gasta cuota de LLM |
| `ml/test_service.py` | Falla en `/health` porque el modelo entrenado no está versionado (`ml/train.py` lo genera). **No es una suite de pytest**: la función se llama `ejecutar_pruebas` y pytest no recolecta nada. Por eso no se agregó a la CI |
| Documentación por carpeta, `docs/INDEX.md`, diagrama de arquitectura y actualización de `AGENTS.md` | No alcanzó el tiempo. `AGENTS.md` sigue desactualizado: "23 verificaciones" (son 53), `supabase/seed.sql` en el árbol y un bloque de reglas de Next.js 16 que no aplica a Next 14.2 |
| Componentes huérfanos `components/ui/{accordion,alert,avatar,collapsible,scroll-area,sheet}` y sus dependencias de Radix | Detectados (cero imports), **no borrados**: sacar dependencias implica tocar el lockfile otra vez |
| 4 `catch {}` vacíos en `app/voz/[cliente]/LlamadaVoz.tsx` | Revisados: son limpieza *best-effort* de Web Audio y SpeechRecognition (`abort()` lanza si ya estaba detenido). Aceptables; falta un comentario |
| Consolidar `.gitignore` (secciones duplicadas) | No alcanzó el tiempo |

## 5. Decisiones que necesita el equipo

1. **Rotar las claves de Supabase** y decidir si se limpia el historial.
2. **Desviación de la regla "nunca `npm install`":** para reparar el lockfile se corrió
   `npm install --package-lock-only` con npm 10 **en una copia fuera del repo**, se revisó el diff
   paquete por paquete y recién después se copió. Está en un commit aparte para poder revertirlo.
3. En el remoto existen `Dev` **y** `dev` apuntando al mismo commit. En Windows y macOS, que no
   distinguen mayúsculas, eso rompe `git fetch` (`unable to update local ref`). Hay que borrar una
   de las dos desde GitHub.
4. `scripts/check-supabase.js`, `scripts/run-seed-remote.js` y `scripts/seed-supabase.js` duplican a
   `scripts/seed-apply.mjs` y nadie los referencia. `check-supabase.js` además prueba un `DELETE`.
   **Se propone eliminarlos.**
5. Los conflictos C1–C7 de [`investigacion-journey-map-llamadas.md`](investigacion-journey-map-llamadas.md) §9.4 siguen abiertos.

## 6. Commits de la auditoría

En orden, todos en `Audit` y **sin push**:

1. `fix(seguridad): sacar las claves de Supabase hardcodeadas de los scripts`
2. `chore(deps): sincronizar package-lock con package.json`
3. `chore(repo): limpiar la raiz del repositorio`
4. `docs(readme): resolver el conflicto de merge en la tabla de rutas`
5. `chore(ci): usar solo npm ci y correr las verificaciones deterministas`
6. `docs(auditoria): registrar la auditoria final del repositorio`
7. `fix(api): no devolver mensajes de error internos en las respuestas 500`
8. `docs(config): completar .env.example y corregir conteos en AGENTS.md`
