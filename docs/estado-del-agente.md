# Estado del agente conversacional

> Última verificación: **13 de septiembre de 2026**. El flujo conversacional, contra
> Supabase y Gemini reales (12 sep); la señal de riesgo, contra `ml/api.py` levantado
> de verdad (13 sep). No es una estimación: cada dato de acá salió de correrlo.

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

### El modelo predictivo alimenta la conversación

`lib/riesgo/` conecta el modelo de `ml/` con el agente. Antes eran dos sistemas que no
se hablaban: el modelo tenía su microservicio y el agente leía una columna estática del
seed. Ahora cada conversación abre con una **señal de riesgo** que combina tres vistas
—el microservicio llamado en vivo, el score de lote de la fila y las reglas de calendario
salvadoreño— y que decide a quién se contacta y por qué escalón empezar.

Medido con el servicio levantado: **2–4 ms por cliente** (presupuesto: 1,500 ms), los
8 personajes conservan su banda y su decisión de contacto, y **el control se mantiene**
—Marta puntúa bajo en las tres vistas y sigue fuera del conjunto de contacto—.
Sin el servicio levantado, idéntico.

Lo que el modelo aporta es la señal; **los textos que el servicio redacta se descartan**
(prometen beneficios que no existen y saltan al escalón más caro), con prueba de
regresión que lo verifica. Detalle completo en
[`senal-de-riesgo.md`](senal-de-riesgo.md).

Se comprueba con `npm run riesgo:demo`.

### La conversación ya no depende del canal

`lib/agent/sesion.ts` es la conversación sin canal: abre, decide si el sistema tiene
derecho a contactar, corre el turno por el validador y lo persiste con `canal` y
`modo_voz`. `app/api/chat/route.ts` quedó como un envoltorio HTTP delgado sobre esas dos
funciones, y el track de voz va a ser otro envoltorio sobre las mismas — con lo que
hereda gratis la señal de riesgo, la escalera y el validador. Es el contrato de
`voice/README.md` cumplido en código y no solo en prosa.

### Verificación automática

`npm run verify:reglas` — **42/42**, sin base de datos. Cubre la detección de
desalineación de quincena y de remesa, la fecha sugerida, la escalera por cliente, los
límites de plazo, los rechazos del validador, y ahora también la composición de la señal
de riesgo, que la señal no pueda apagar un contacto justificado ni inventar opciones
fuera de la escalera, que el puntaje y la jerga de riesgo no se filtren al prompt, y que
el texto del servicio de ML se descarte.

`npm run type-check`, `npm run lint` y `npm run build`: los tres limpios.

### Datos

308 clientes sembrados: los 8 personajes del pitch más 300 sintéticos, generados de
forma determinista (mismo seed → mismo archivo byte a byte). Ver
[`supabase/README.md`](../supabase/README.md).

---

## El caso de voz (pipeline STT → LLM → validador → TTS)

Verificado de punta a punta contra Supabase, el microservicio de ML y los motores de voz
reales. Conversación hablada completa de Karla, cerrada con acuerdo:

```
CONVERSACION: canal=voz · modo_voz=pipeline · cerrada_con_acuerdo
              motivo_contacto=desalineacion_quincena · riesgo_fuente=modelo_vivo
ACUERDO     : escalon 2 · mover_fecha · $145.00 · 2026-09-16
ETAPAS      : turno 0 ->             llm 13925 | val 0 | tts 1127
              turno 2 -> stt 1550  | llm 31520 | val 0 | tts 1339
              turno 4 -> stt 1328  | llm 17978 | val 1 | tts 1078
```

Todo local y sin cuenta: **whisper.cpp** transcribe y **Piper** sintetiza
(`npm run voz:instalar`, ~230 MB a `voice/pipeline/bin/`, gitignoreado). El LLM sigue
siendo intercambiable por variable de entorno.

**El validador cuesta 0–1 ms.** Es el número para el Q&A: el guardrail determinista —lo
que ningún speech-to-speech puede garantizar— no se paga en latencia.

### Tres fallas que solo aparecieron al correrlo

Ninguna se veía en las verificaciones estáticas, y las tres estaban en el turno de
cierre o cerca:

1. **Los modelos chicos tipan mal el JSON de las tools.** `qwen2.5:3b` manda
   `monto: null` en vez de omitir el campo; `llama3.1` manda `{"monto":"145",
   "diaAcordado":"16"}` con los números como texto. Zod los rechazaba enteros y el
   acuerdo no se registraba nunca. Hoy se convierten antes de validar, y los rangos
   siguen corriendo después.
2. **El agente narraba las fallas internas.** Al fallar la herramienta le dijo a la
   persona *"hubo un error al registrar el acuerdo"*. El payload de error ahora lleva la
   instrucción explícita de no mencionarlo. Los errores de tool se loguean en el
   servidor con los argumentos recibidos — sin eso no había cómo diagnosticar.
3. **Los ataques por voz cortaban a la persona.** El reconocedor estaba en
   `continuous = false`, con lo que la Web Speech API cierra el turno en la primera
   pausa en vez de esperar a que se suelte el botón.

---

## Para la próxima sesión

### La tabla de la batería es insumo, no veredicto

`scripts/bateria-ataque.ts` solo marca **falla automática** en tres casos: apareció algo
prohibido por regex, faltó algo requerido, o cerró un acuerdo a partir del mensaje
tramposo. Todo lo demás sale como **"revisar"**.

Eso significa que un resultado de "20/20 sin violaciones automáticas" **no es un
aprobado**: quedan por juzgar a mano el tono y si la alternativa ofrecida era válida y
del escalón correcto. Hay que leer la tabla entera antes de mostrarla en el pitch.

### Sobre qué modelo correr la batería

La corrida hecha es con `llama3.1` local. **El demo va a correr con Gemini**, y los
modelos se comportan distinto: medido, `llama3.1` sin ejemplos en el prompt no pasaba el
validador ni una vez. La batería hay que repetirla sobre el modelo que se vaya a usar en
vivo — pero son ~40 llamadas, o sea el doble de la cuota diaria de un modelo del tier
gratuito. Decidir eso antes de ensayar.

### Los ejemplos de brevedad solo van a Ollama

`EJEMPLOS_BREVEDAD` en `lib/agent/prompt.ts` se inyecta **solo** cuando el proveedor es
Ollama (`orchestrator.ts` lo decide). Medido con `npm run evaluar:brevedad`:

| Modelo | Sin ejemplos | Con ejemplos |
|---|---|---|
| `llama3.1:8b` | 0/12 · 5.2 y 4.3 frases | **11/12** · 2.8 y 3.0 frases |
| `qwen2.5:3b` | 0/12 · 5.3 frases | 0/12 · 4.1 frases |

En 8B resuelven el problema; en 3B ayudan pero no cruzan el umbral de 3 frases. Si se
cambia de modelo local, **volver a correr esa medición** antes de confiar.

### Deuda conocida

- **Voseo inconsistente.** Con los tres modelos aparecen deslices al tuteo
  (*"¿Quieres que te envíe…?"*). El validador no lo chequea y vale dentro de los 20
  puntos de calidad conversacional.
- **Recortar en vez de descartar.** Cuando el validador rechaza por `demasiadas_frases`
  se tira una respuesta que era correcta y se sirve la genérica. Recortar a 3 frases y
  revalidar recuperaría la mayoría de esos turnos sin debilitar nada, porque el texto
  recortado pasaría el validador completo. Evaluado y no implementado.
- **La latencia del LLM domina todo.** Con `llama3.1` un turno hablado son ~70 s porque
  el modelo no cabe en los 4 GB de VRAM de la laptop. STT y TTS juntos son ~3 s.

---

## Qué NO está hecho todavía

| Falta | Nota |
|---|---|
| **Batería de 20 ataques ejecutada** | ⚠️ **Corrección: no era la cuota.** El arnés no compilaba — usaba `await` de nivel superior y `tsx` compila a CommonJS, que no lo admite, así que `npm run ataque` fallaba antes del primer ataque. Ya está arreglado y corre (`CANAL=voz npm run ataque` para el canal hablado). Falta la corrida completa y revisar su tabla a mano. **Sigue siendo lo más importante**: el jurado anunció que va a intentar romper el agente. |
| **Dashboard** | 10 puntos. Los datos que necesita ya se persisten: latencia, tokens, `validador_ok`, acuerdos por tipo y —desde la migración `20260913120000`— la señal de riesgo y el motivo de contacto por conversación. Es sobre todo lectura y presentación. |
| **Voz — pipeline** | ✅ Construido y verificado de punta a punta. Ver la sección "El caso de voz" abajo. Falta la revisión humana de la batería por voz. |
| **Voz — speech-to-speech** | `voice/speech-to-speech/` sigue vacío de código. Consumiría la misma `lib/agent/sesion.ts` pasando `modoVoz: "s2s"`. |
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

⚠️ **Antes de correr el demo con la señal de riesgo hay que aplicar la migración nueva**
(`20260913120000_senal_riesgo_en_conversaciones.sql`). Sin ella, `crearConversacion`
falla al insertar columnas que no existen. Es idempotente, pero `npm run db:migrate`
reejecuta todos los archivos en orden y el primero ya no se puede volver a aplicar: lo
más rápido es pegar solo ese archivo en el SQL Editor del dashboard.
