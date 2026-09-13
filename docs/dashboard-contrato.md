# Contrato de datos del dashboard

Handoff para quien haga la UI. **La UI no calcula nada**: todo número sale ya calculado
del contrato. Si una vista necesita una cifra nueva, se agrega en
[`lib/dashboard/metricas.ts`](../lib/dashboard/metricas.ts) y en
[`lib/dashboard/types.ts`](../lib/dashboard/types.ts), no en el componente.

## Cómo consumirlo

| Desde | Qué usar |
|---|---|
| Server Component | `obtenerResumenDashboard()` y `obtenerDetalleConversacion(id)` de `lib/dashboard/servicio.ts` |
| Client Component o fuera de Next | `GET /api/dashboard` y `GET /api/dashboard/conversaciones/[id]` |

Formato de las respuestas: `{ success: true, data }` o `{ success: false, error: { code, message } }`.
Códigos de error: `VALIDATION_ERROR` (400, id que no es UUID), `NOT_FOUND` (404) y `SERVER_ERROR` (500).

La vista actual ([`app/dashboard/`](../app/dashboard)) es deliberadamente mínima. Se
puede reemplazar entera: `formato.ts` (formato y etiquetas en español) se puede reutilizar.

## Reglas que la UI tiene que respetar

- **Toda tasa se muestra con su n.** `Tasa` trae `numerador`, `denominador` y `valor`
  (de 0 a 1). Con denominador 0, `valor` es `null`: mostrá "—", nunca "0 %" ni "100 %".
- **`null` significa "sin datos", no cero.** Aplica a percentiles, promedios y costos por unidad.
- **Base vacía:** después de `npm run demo:reset` no hay conversaciones. `cartera` sí trae
  datos; `gestion` y `tecnico` vienen en 0 o `null`.
- **Nada hardcodeado que parezca medido.** Si una métrica no está en el contrato, no existe.

## `ResumenDashboard`

### `gestion`

| Campo | Fuente | Unidad | Notas |
|---|---|---|---|
| `conversaciones.total`, `porEstado`, `porCanal` | `conversaciones.estado`, `canal` | conteo | `porEstado` trae siempre los 4 estados |
| `cierreConAcuerdo` | `conversaciones.estado` | Tasa | `cerrada_con_acuerdo` ÷ cerradas (con acuerdo + sin acuerdo + escalada). **Excluye abiertas**: los ensayos abandonados no bajan la tasa |
| `escalamientoHumano` | `conversaciones.estado` | Tasa | `escalada_humano` ÷ cerradas |
| `acuerdosPorEscalon` | `acuerdos.escalon` + `ESCALERA` | conteo | Siempre los 8 escalones, en orden. Incluye `pase_humano` (escalón 8) |
| `cuotasProtegidas` | `clientes.cuota` de las conversaciones `cerrada_con_acuerdo` | USD | **Cada cliente cuenta una vez**, aunque tenga varios ensayos. Es la cifra de "mora evitada" |
| `montoComprometido` | `acuerdos.monto` de las conversaciones `cerrada_con_acuerdo` | USD | Informa aparte los acuerdos sin monto (p. ej. débito automático). No suma por cliente único |
| `motivosNoAcuerdo` | `acuerdos.motivo_no_acuerdo` | conteo | Texto libre del agente, ordenado de mayor a menor |

### `cartera`

| Campo | Fuente | Unidad | Notas |
|---|---|---|---|
| `totalClientes`, `porBanda` | `clientes.riesgo_banda` | conteo | `SIN_BANDA` = sin puntaje del scorer |
| `requierenContacto` | `diagnosticar()` de `lib/agent/calendario.ts` | conteo | Es la misma regla con la que el agente decide abrir. Depende de la fecha: se evalúa en `generadoEn` |

### `tecnico`

| Campo | Fuente | Unidad | Notas |
|---|---|---|---|
| `latenciaAgenteMs` | `turnos.latencia_ms`, `rol = agente` | ms | p50/p95/máx por nearest-rank (siempre un valor observado). Incluye herramientas y reintento del validador |
| `duracionConversacionSeg` | `cerrada_en − iniciada_en` | segundos | Solo conversaciones cerradas |
| `tokens` | `turnos.tokens_in`, `tokens_out` | tokens | El promedio es entre conversaciones con al menos un turno del agente |
| `costo` | tokens × precio de `lib/dashboard/precios.ts` | USD | Ver límites abajo. Un modelo sin precio **no se estima**: va a `turnosSinPrecio` |
| `validador.intervencion` | `turnos.validador_ok = false` | Tasa | Sobre turnos del agente con validador registrado. Un reintento que salió bien igual cuenta |
| `validador.motivos` | `turnos.validador_motivo` | conteo | Claves de `MotivoRechazo`; etiquetas en `formato.ts` |
| `modelos` | `turnos.modelo_version`, antes de la `/` | conteo | La rotación real entre modelos |

### `provisiones` (Nivel 3)

`saldo × (%reserva(días de atraso + 30) − %reserva(días de atraso))`, con la tabla de
consumo NCB-022, por cliente único con acuerdo. El texto del supuesto viene en
`provisiones.supuesto` y **tiene que mostrarse junto a la cifra**: es un escenario, no
una medición.

### `auditoria`

Una `FilaAuditoria` por conversación, de la más reciente a la más antigua. El nombre
viene enmascarado (`K. M*****`). La transcripción **no** está en el resumen; se pide por
conversación.

## `DetalleConversacion`

- `fila`: la misma `FilaAuditoria` del resumen.
- `turnos`: la transcripción completa en orden, con texto y métricas. Los turnos del
  cliente tienen las métricas en `null`. **El texto no está enmascarado**: es la
  evidencia literal.
- `acuerdoRegistrado`: la fila de `acuerdos`, o `null` si la conversación no cerró.

## Límites conocidos de los datos

1. **El costo es un piso.** Google cobra los tokens de razonamiento como salida, pero
   `tokens_out` guarda `candidatesTokenCount`, que no los incluye.
2. **El costo de los turnos con herramientas o con reintento también se subcuenta.** En
   `lib/agent/orchestrator.ts`, cada vuelta del ciclo de herramientas pisa `tokensIn` y
   `tokensOut`, y un reintento exitoso reemplaza los tokens del intento rechazado. Solo
   queda registrada la última llamada.
3. **El demo corre en el tier gratuito**: el costo real hoy es $0. El dashboard muestra
   el precio de lista de producción.
4. **Sin autenticación.** `/dashboard` y `/api/dashboard` son públicos, igual que
   `/api/chat`. El detalle incluye la transcripción literal.

## Pendiente: no se muestra porque no hay datos

| Métrica | Qué falta |
|---|---|
| TTFB, barge-in, grabación de audio | El canal de voz no tiene código |
| Puntaje de empatía, sentimiento, % de voseo | Un evaluador (LLM-as-judge) que no existe |
| Contactabilidad | Registro de intentos de contacto; hoy solo existen conversaciones abiertas |
| % de PII enmascarado | Enmascaramiento en la persistencia; hoy se guarda el texto literal |
| Costo contra call center humano | Una referencia con fuente; la de $0.85 del doc del equipo no la tiene |
| Telemetría ML y drift | Existe en `GET /api/monitoring`, fuera de este contrato. Devuelve datos **simulados** si el servicio Python no corre (`status: "fallback_simulation"`) |
