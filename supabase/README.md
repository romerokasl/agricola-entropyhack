# Base de datos — Supabase

El esquema del agente conversacional vive en `migrations/`, versionado por archivo.
**Nunca crear ni alterar tablas desde el dashboard de Supabase** — se pierde el
historial y rompe a las otras laptops.

> `UML.md` en la raíz describe el dominio **pre-pivote** (el scorer con pantallas) y
> **no** es el esquema vigente del agente. Ver la nota de advertencia en ese archivo.

## Esquema

`migrations/20260912150000_create_agent_schema.sql` — cuatro tablas:

| Tabla | Qué guarda | Por qué existe |
|---|---|---|
| `clientes` | Solo lo que el agente necesita para conversar: cuándo le entra la plata (`tipo_ingreso`, `dia_ingreso_1/2`, `dia_remesa`), la obligación (`cuota`, `saldo`, `dia_pago`, `dias_atraso`) y la salida del scorer (`riesgo_score`, `riesgo_banda`) | Sin esto el agente no tiene de qué hablar |
| `conversaciones` | `canal` ('texto'\|'voz'), `modo_voz` ('pipeline'\|'s2s'\|NULL), `apertura` ('agente'\|'cliente'), `estado` | Permite comparar los dos enfoques de voz con datos reales sin confundir texto con dato faltante |
| `turnos` | Rol, texto, `latencia_ms`, `tokens_in/out`, `validador_ok`, `modelo_version` | **Es la transcripción que el banco pide textualmente** como evidencia técnica, y la fuente de las métricas del dashboard |
| `acuerdos` | `escalon` (1–8), `tipo`, `monto`, `fecha_acordada` — o `motivo_no_acuerdo` | **Es el "resultado registrado"** de la lámina del banco |

Dos constraints que valen la pena conocer:

- `modo_voz_solo_en_canal_voz` — `modo_voz` tiene que ser NULL cuando `canal='texto'`
  y no-NULL cuando `canal='voz'`. Hace imposible el estado ambiguo.
- `acuerdo_o_motivo` — o hay acuerdo (escalón + tipo) o hay un motivo de por qué no.
  Nunca ambos, nunca ninguno: una conversación que no cierra en nada igual tiene que
  quedar registrada.

RLS está activado en las cuatro tablas **sin políticas permisivas**: el cliente anónimo
no lee nada y toda escritura pasa por Route Handlers con service role.

## Generador de datos

`seed.sql` está **generado automáticamente** — no editarlo a mano. Se regenera con:

```bash
node scripts/generate-seed.mjs
```

Produce **308 clientes**: los **8 personajes del pitch** escritos a mano (cada uno
existe para demostrar un patrón de conversación distinto, ver
`docs/contexto/01-reglas-del-agente.md` §7) más **300 sintéticos** para que el panel de
riesgo del dashboard no se vea con 8 filas.

**Es determinista.** Misma semilla → mismo archivo byte a byte. Por eso se commitean
los dos: el script (para regenerar) y el `seed.sql` (para aplicarlo sin tener Node).

### Qué controla qué — si se va a modificar

| Constante / función | Dónde | Qué cambia |
|---|---|---|
| `SEED` | arriba del archivo | La semilla del PRNG. Cambiarla regenera un dataset **completamente distinto**. Si se cambia, hay que volver a verificar los casos del demo. |
| `SYNTHETIC_COUNT` | arriba del archivo | Cuántos clientes sintéticos se generan (los 8 personajes son aparte y siempre están). |
| `PERSONAJES` | array grande | Los 8 casos del pitch, a mano. **Editar con cuidado:** los datos de Karla y Marta son los que hacen funcionar el caso estrella y el caso de control. |
| `generarCliente()` → `chance(0.35)` | dentro | Qué proporción de los clientes quincenales queda **desalineada** (cuota vence entre el 5 y el 12, antes de que entre la quincena). Es el patrón que el agente detecta. |
| `generarCliente()` → `chance(0.15)` | dentro | Qué proporción recibe **remesas** (y parte de esas queda desalineada también). |
| `generarCliente()` → `chance(0.2)` | dentro | Qué proporción arranca **ya con atraso**. |
| `derivarRiesgo()` | función | Cómo se traduce cada señal a `riesgo_score` y banda. **Los pesos están calibrados a propósito** para que un sintético con el perfil de Karla caiga en su misma banda (MODERATE_HIGH) y uno con el de Marta en la de Marta (LOW). Si se desajustan, el dashboard empieza a contradecir al agente. |

### Por qué el score se deriva de las señales

No es ruido aleatorio: sale de las mismas señales que disparan una conversación
(desalineación de quincena, desfase de remesa, días de atraso, débito automático). Así
el panel "clientes en riesgo por banda" es coherente con los casos que el agente
realmente abre. Un score aleatorio haría que el dashboard y el agente cuenten historias
distintas.

### El caso de control

**Marta Cruz no se excluye con un flag.** Que el sistema no la contacte se **deriva** de
sus datos: riesgo bajo, sin atraso, calendario alineado y con débito automático activo.
Esa es la diferencia entre un modelo y un megáfono — y es auditable, no hardcodeado.

## Aplicar el esquema y los datos

Hay tres rutas. **La del SQL Editor es la que siempre funciona**; las otras dos dependen
de tener herramientas o la connection string correcta.

### A. SQL Editor del dashboard (la más confiable)

1. Abrir el SQL Editor del proyecto
2. Pegar el contenido de `migrations/20260912150000_create_agent_schema.sql` → Run
3. Pegar el contenido de `seed.sql` → Run

Sigue respetando la regla de "nunca crear tablas desde el dashboard": el archivo
versionado es la fuente de verdad, el editor solo lo ejecuta.

### B. Desde Node, sin psql (Windows-friendly)

```bash
npm run db:migrate   # aplica supabase/migrations/ en orden
npm run seed:apply   # siembra los 308 clientes
```

`seed:apply` usa la API REST y funciona siempre. **`db:migrate` necesita un
`DATABASE_URL` que resuelva**, y ahí está el detalle importante:

> ⚠️ La connection string **directa** (`db.<ref>.supabase.co`) hoy es solo IPv6 y falla
> con `ENOTFOUND` en redes IPv4. Hay que usar la del **Session pooler**
> (`...pooler.supabase.com:5432`, usuario `postgres.<ref>`), que sí resuelve por IPv4.
> Está en Project Settings → Database → Connection string → *Session pooler*.

### C. psql

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260912150000_create_agent_schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql
```

Aplica la misma advertencia sobre el pooler. Nadie en el equipo tiene `psql` instalado,
así que en la práctica se usa A o B.

`seed.sql` arranca con un `truncate ... cascade` y `seed:apply` limpia antes de
insertar: los dos son idempotentes, se pueden correr las veces que haga falta.
