# Estado del agente conversacional

> Última verificación: **12 de septiembre de 2026**, contra Supabase y Gemini reales.
> No es una estimación: cada dato de acá salió de correrlo.

## Resumen en una línea

El flujo crítico que pide el banco — **conversar → comprender → negociar → cerrar →
registrar** — funciona de punta a punta por el canal de texto, con el caso de Karla.

---

## Qué funciona hoy

### El flujo de Karla, verificado end-to-end

Conversación real registrada en la base:

> **Agente:** Hola Karla, te saluda el asistente virtual de Bancoagrícola. Veo que la
> cuota de tu tarjeta de $145.00 vence el 8 de cada mes, unos días antes de tu pago
> quincenal. ¿Se te complica esa fecha para estar al día, o te queda bien?
>
> **Karla:** la verdad siempre se me complica, para el 8 ya ando sin pisto. hasta el 15
> me cae la quincena
>
> **Agente:** Tiene todo el sentido, Karla. Podemos moverte la fecha de pago del día 8
> al día 16 de cada mes, justo un día después de tu quincena y sin ningún costo. ¿Te
> parece si la dejamos fija para el 16?
>
> **Karla:** si, de acuerdo, movela al 16 por favor
>
> **Agente:** Listo, Karla, ya quedó registrado el cambio. A partir de ahora tu cuota de
> $145.00 vencerá los días 16 de cada mes. Así podrás pagar con tranquilidad justo
> después de recibir tu quincena.

Lo que quedó en la base:

| Tabla | Contenido |
|---|---|
| `acuerdos` | `escalon 2` · `mover_fecha` · `$145.00` · `2026-09-16` |
| `conversaciones` | `cerrada_con_acuerdo` · `canal=texto` · `modo_voz=null` · `apertura=agente` |
| `turnos` | La transcripción completa, con latencia, tokens, validador y modelo por turno |

Los tres turnos del agente pasaron el validador sin intervención. Latencias medidas:
**4.8 s** y **7.3 s** (el turno de cierre incluye la llamada a la herramienta).

### El caso de control

`/chat/marta` devuelve **409 NO_CONTACTAR**: *"El sistema no abre conversación con Marta
Cruz: Nada que requiera contacto: sin atraso, calendario alineado y riesgo bajo."*

Se deriva de sus datos, no de un flag en la base. Y si **ella** escribe primero, sí se
permite — porque en producción un cliente siempre puede iniciar. Verificado: Wilber
(6 días de atraso) sí dispara contacto; Marta no.

### Verificación automática

`npm run verify:reglas` — **23/23**, sin red ni base de datos. Cubre la detección de
desalineación de quincena y de remesa, la fecha sugerida, la escalera por cliente, los
límites de plazo, y los rechazos del validador.

`npm run type-check`, `npm run lint` y `npm run build`: los tres limpios.

### Datos

308 clientes sembrados: los 8 personajes del pitch más 300 sintéticos, generados de
forma determinista (mismo seed → mismo archivo byte a byte). Ver
[`supabase/README.md`](../supabase/README.md).

---

## Qué NO está hecho todavía

| Falta | Nota |
|---|---|
| **Batería de 20 ataques ejecutada** | El arnés está listo (`npm run ataque`) y escribe la tabla para el README. No se corrió por cuota. **Es lo siguiente más importante**: el jurado anunció que va a intentar romper el agente. |
| **Dashboard** | 10 puntos. Los datos que necesita ya se persisten: latencia, tokens, `validador_ok` y acuerdos por tipo. Es sobre todo lectura y presentación. |
| **Voz** | `voice/pipeline/` y `voice/speech-to-speech/` siguen vacíos de código. La capa compartida que ambos van a consumir ya existe. |
| **Fallback a Groq** | Decidido desde el principio, sin construir. Dejó de ser opcional (ver la sección de cuota). |
| **Resumen de historial** | No implementado a propósito: se dispara pasados 10 turnos y el flujo de Karla tiene 5. Antes de eso es costo sin beneficio. |

---

## Lo que se aprendió corriéndolo

Seis fallas que **ninguna verificación estática podía ver** — todas aparecieron al
conectarlo a los servicios reales. Vale la pena tenerlas presentes porque varias van a
reaparecer en el track de voz:

1. **La API rechaza `contents` vacío**, que es exactamente el caso en que el agente abre
   la conversación. Se resolvió con un disparador que no se persiste.
2. **`maxOutputTokens` incluye los tokens de razonamiento.** Con el valor de 200 que
   decían los docs, el modelo gastaba 189 pensando y truncaba el mensaje a media frase.
   La brevedad ahora la garantiza el validador, no el presupuesto de tokens.
3. **Gemini 3.x rechaza con 400 un `functionCall` reenviado sin su `thoughtSignature`.**
   Solo se manifestaba al cerrar el acuerdo — el momento más importante del demo.
4. **El validador contaba `"$145.00"` como dos frases** por el punto decimal. Como el
   mensaje de cierre siempre menciona el monto, el cierre se rechazaba casi siempre.
   Hay una prueba de regresión para esto.
5. **Calcular el índice del turno con una consulta extra** se caía con Gateway Timeout.
   Ahora se deriva del historial que ya está en memoria.
6. **Supabase y Gemini fallan de forma transitoria** en el tier gratuito, y en vivo eso
   se ve igual que un bug. Hay reintentos con backoff en las dos capas.

---

## 🚨 El riesgo abierto más serio: la cuota

**Medido, no estimado:** el tier gratuito da
`GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20` — veinte peticiones por día
**y por modelo**. Una conversación completa consume entre 4 y 6.

Mitigación ya implementada: como la cuota es por modelo, el proveedor **rota entre
cinco** y cada turno registra cuál lo atendió de verdad.

Pero eso da ~100 peticiones diarias, y la necesidad real ronda las **500–700** (batería
de ataque + 20 ensayos + iteración). **La decisión de tier quedó pendiente para la
próxima sesión.** El detalle de opciones y costos está en
[`docs/contexto/03-seleccion-modelo-llm.md`](contexto/03-seleccion-modelo-llm.md).

⚠️ Mientras tanto: **cada ensayo completo quema cuota real.**

---

## Cómo levantarlo

```bash
npm ci
npm run db:migrate    # crea las 4 tablas
npm run seed:apply    # siembra los 308 clientes
npm run dev
```

| URL | Qué demuestra |
|---|---|
| `/chat/karla` | ⭐ El caso estrella completo |
| `/chat/karla?apertura=cliente` | La persona escribe primero; el agente igual se presenta |
| `/chat/marta` | El control: 409, el sistema no la contacta |

`npm run demo:reset` deja el estado limpio entre ensayos.
