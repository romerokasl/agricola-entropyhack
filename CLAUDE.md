# CLAUDE.md — agricola-entropyhack

Contexto permanente del repo. Lo leen Claude Code, Cursor, Antigravity y cualquier
agente que trabaje acá. **Reemplaza la versión del 6 de septiembre**, que describía un
producto distinto al que pidió el banco.

---

## Qué es esto

Entropy Hack 2026 · Key Institute · El Salvador · Reto **Bancoagrícola**.

**El reto es un AGENTE CONVERSACIONAL DE COBRANZA PREVENTIVA.** La conversación no es
una feature: es el producto. Lo confirmó el brief oficial del banco el 12 de septiembre.

**Flujo crítico:** `Conversar → Comprender → Adaptarse → Negociar → Cerrar → Registrar`

> *"No buscamos solo respuestas inteligentes. Buscamos una gestión completa, empática,
> trazable y orientada a un resultado."* — Bancoagrícola

**La tesis:** no es un cobrador. Es una conversación que protege el récord crediticio de
la persona. El pago llega como consecuencia de eso, nunca al revés.

---

## 🎯 Cómo se evalúa (pesos oficiales)

| Criterio | Peso |
|---|---|
| Calidad conversacional | **20** |
| Efectividad de la gestión | **20** |
| Solidez técnica | **20** |
| Dashboard y datos | **10** |

Suman 70; faltan 30 sin confirmar (probablemente pitch y negocio).

**Implicación para cualquier decisión técnica:** 40 puntos están en la conversación y
en cerrar acuerdos. El scorer de riesgo, por bueno que sea, no mueve esos 40 puntos.

---

## Stack

Next.js 14.2.24 · React 18 · TypeScript estricto · Tailwind 3 · Supabase ·
microservicio Python FastAPI en `ml/` · Vercel.

- `npm ci` para instalar (**no `npm install`** — reescribe el lockfile y genera
  conflictos entre las 4 laptops)
- El servicio de Python corre local: `cd ml && uvicorn api:app --port 8000`
- `/api/predict` tiene **fallback determinista**: la app funciona sin el servicio Python

---

## Reglas del agente

**El archivo de referencia es `01-REGLAS-DEL-AGENTE.md`.** Lo esencial:

### Guardrails que no se pueden romper (los puso el banco)

- ❌ Nunca amenazar ni insinuar consecuencias legales
- ❌ Nunca culpar ni juzgar
- ❌ Nunca mencionar terceros (familia, empleador, referencias)
- ❌ Nunca ofrecer **productos de otro banco**
- ❌ Nunca inventar productos, tasas o beneficios que no existen
- ❌ Nunca aceptar plazos irreales
- ✅ **Una sola acción recomendada por mensaje** (evidencia PNAS 2025, 13M personas)
- ✅ Siempre ofrecer salida a un humano
- ✅ Nunca urgencia falsa: si faltan 6 días, son 6 días
- ✅ Cero jerga: "tu pago", "tu récord", "te faltan" — nunca "score", "mora", "provisión"
- ✅ Español salvadoreño cálido, voseo natural, 2–3 frases por turno

### Límites de negociación

```
PLAZO    ✅ vencimiento, o 1–3 días después · mover fecha al siguiente ciclo
         ❌ más de 30 días · meses · años
MONTO    ✅ total, o abono parcial que evite el deterioro
         ❌ condonar capital o intereses
PRODUCTO ✅ solo la escalera de opciones (abajo)
         ❌ cualquier cosa fuera de esa lista
```

### Escalera de opciones — ofrecer siempre el escalón mínimo suficiente

1. Recordatorio / confirmación — $0
2. **Mover la fecha de pago a la quincena** ⭐ — $0
3. Abono parcial que evita la mora — $0
4. Activar débito automático — $0
5. Dividir la cuota en 2 pagos quincenales — bajo
6. Adelanto de Salario / Extrafinanciamiento *(productos reales de BA)* — medio
7. Reestructura / readecuación — alto
8. Pase a asesor humano — alto

### Configuración

`temperature: 0.2` (recomendación explícita del ingeniero de IA del banco) ·
`max_tokens` ~200 · validador determinista en cada turno antes de mostrar la respuesta.

### 🚨 El jurado va a intentar romper el agente en vivo

Lo anunciaron. La batería de 20 ataques está en `01-REGLAS-DEL-AGENTE.md` §4.
**Correrla y documentar el resultado en el README.**

---

## Los 5 insights locales — van DENTRO de la conversación

1. **La quincena.** Se cobra el 15 y el 30. Si la cuota vence el 8, la persona falla
   todos los meses. Detectarlo y ofrecer mover la fecha cuesta cero. **Es el caso
   estrella del demo.**
2. **Las remesas.** ~24 % del PIB; el banco ya las cobra en su app. Si la remesa entra
   el 5 y la cuota vence el 3, son 2 días que generan mora 12 veces al año. **Señal que
   ningún buró tiene.**
3. **La ventana de 10 días.** Por ley los burós actualizan los primeros 10 días del mes.
   El agente lo nombra con exactitud. Urgencia honesta y verificable.
4. **890+ corresponsales**, 100 % de distritos. *"Podés pagar a dos cuadras."*
5. **Productos que ya existen.** Adelanto de Salario, Extrafinanciamiento, Sobregiro
   Elite. **El banco prohibió inventar productos — nosotros ya tenemos la lista real.**

---

## Datos del banco (dichos en vivo el 12 sep)

- **~30,000 clientes** en incumplimiento en algún momento
- **~90 % es mora temprana** — se les olvidó, no es que no puedan pagar
- Canales actuales: **voz (mucho)**, WhatsApp, correo, SMS
- Ya usan bots, pero *"tienen cierta rigidez… seguir una ruta de conversación específica"*
- Persona arquetipo del banco: **Valentina** (metas: estudios, hogar, metas, finanzas
  saludables). Propósito: **"Bienestar para todos"**

## Contexto de industria (verificado)

- Bancoagrícola: #1 del país, 24.2 % de la cartera bruta, **750,000 usuarios de banca
  móvil**, **$17.5 M de inversión tecnológica en 2026**, 62 agencias y +890 corresponsales
- Sistema: cartera $19,978.8 M; consumo+vivienda $9,348.2 M; **morosidad 1.50 %**
  ⚠️ **No pitchear "crisis de mora"** — es bajísima y el jurado es bancario
- **PNAS 2025**: recordatorios conductuales reducen morosidad a 60 días 0.42–0.57 pp;
  **una sola acción por mensaje** funciona mejor que varias
- **NCB-022 (SSF)**: clasifica por días de mora y determina el % de reserva. Evitar el
  deterioro libera provisiones — ahí está el ROI
- **Ley de Protección al Consumidor**: prohíbe cobros difamatorios. **El tono empático
  es cumplimiento normativo**, no decoración

---

## Diseño

**El canal se ve como WhatsApp.** El banco lo recomendó explícitamente. Telegram o app
de mensajes también sirven.

Colores de marca (extraídos del sitio real y coherentes con las láminas del banco):

| Token | HEX | Uso |
|---|---|---|
| amarillo | `#FDDA24` | relleno de botones. **NUNCA texto** (1.5:1 sobre blanco) |
| grafito | `#2C2A29` | texto principal, texto sobre amarillo |
| verde | acento | aparece en las láminas oficiales |

**El cliente NUNCA ve rojo.** Rojo = vergüenza = evasión, y el reto pide empatía.
El rojo vive solo en la consola interna del banco.

⚠️ El `tailwind.config.ts` del repo trae `agricola-blue #003B71`. Ese azul no aparece ni
en el sitio ni en las láminas del banco. Verificar antes de que domine la UI.

---

## Alcance: qué es simulado y qué no

| Simulado (lo pidió el banco) | Real y desplegado |
|---|---|
| El canal (se ve como WhatsApp, no lo es) | La app, en una URL pública |
| Los datos del cliente (dataset de juguete) | La BD con las conversaciones registradas |
| El pago (no se mueve dinero) | El agente LLM respondiendo de verdad |
| La integración con sistemas del banco | El dashboard con métricas calculadas |

**"Demo" no significa "mockup estático".** El banco pide *demo estable, repositorio y
README, transcripción y resultado, dashboard con métricas* — eso es software
funcionando. Construir algo desplegado cumple el brief mejor, no lo contradice.

---

## Convenciones

- Ramas `feat/*`, `fix/*`, `chore/*`. **Nunca trabajar en `main`**
- Conventional commits. **Uno por acción**, granularidad máxima sin romper el árbol,
  y el mensaje explica **el porqué**, no el qué
- PRs pequeños. El CI debe pasar antes de mergear
- Un dueño por archivo grande — el 90 % de los conflictos de merge en un hackatón son
  dos personas en el mismo componente
- Código, archivos y ramas en inglés. **UI y dominio en español**
- Prohibido `any` en TypeScript
- `SUPABASE_SERVICE_ROLE_KEY` **solo** en Route Handlers y Server Components. Jamás en
  el cliente, jamás con prefijo `NEXT_PUBLIC_`
- Migraciones de esquema por archivo en `supabase/migrations/`, nunca desde el dashboard
- **No mezclar Alembic con las migraciones de Supabase.** Un solo sistema

---

## Prioridades cuando hay que elegir

**Profundidad > amplitud.** Lo dijo el banco: *"Una funcionalidad estable vale más que
diez incompletas."*

El flujo que tiene que estar impecable: **conversar → comprender → negociar → cerrar →
registrar**, con el caso de Karla.

- Si una tarea va a tomar más de 45 min, parar y proponer dos alternativas más baratas
- El estado del demo se resetea con un comando — se va a correr veinte veces
- Probar el modo sin red **temprano**, no a las 3 a.m.
- **Congelar features** con 6 h restantes · **grabar el video de respaldo** con 4 h
