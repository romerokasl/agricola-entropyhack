# Plan de implementación — pipeline STT → LLM → Validador → TTS

> **Qué es este documento:** el orden de construcción del caso de voz, sobre lo que ya
> existe en el repo. **No** repite la comparación de proveedores: esa vive en
> [`model-selection.md`](model-selection.md) y su copia en
> [`../../../docs/contexto/03-seleccion-modelo-llm.md`](../../../docs/contexto/03-seleccion-modelo-llm.md).
> La investigación de costo cero de septiembre 2026 **confirmó** esas dos tablas sin
> cambiarlas — no hay decisión de proveedor que rehacer.
>
> Única novedad de esa investigación, y no aplica a esta carpeta: **Gemini Live Flash
> sigue en $0** (los modelos Pro pasaron a pago en abril 2026), así que S2S a costo cero
> es viable. Eso es insumo para `voice/speech-to-speech/`, no para el pipeline.

---

## 1. Punto de partida: lo que NO hay que construir

Esta es la razón por la que el caso de voz es barato. El motor conversacional es
**agnóstico al canal** y ya está verificado end-to-end en texto
([`estado-del-agente.md`](../../../docs/estado-del-agente.md)).

| Pieza | Estado | ¿Cambia para voz? |
|---|---|---|
| `ejecutarTurno()` (`lib/agent/orchestrator.ts`) | Verificado en texto | **No. Cero cambios.** Entra texto, sale texto validado y persistido |
| Validador determinista (`lib/agent/validator.ts`) | 23/23 en `npm run verify:reglas` | No — y es justo el punto de intercepción pre-audio que sostiene toda la arquitectura |
| Tools (`consultarCliente`, `consultarOpcionesValidas`, `registrarAcuerdo`) | Funcionando | No |
| Escalera, reglas, prompt | Congelados | No |
| Esquema `conversaciones.canal` / `modo_voz` | **Ya existe**, con CHECK que obliga `modo_voz` cuando `canal='voz'` | **No hace falta migración** para el loop básico |
| `crearConversacion({ canal, modoVoz })` | Ya parametrizado | No — hoy `/api/chat` pasa `'texto'`/`null` hardcodeado; voz pasa `'voz'`/`'pipeline'` |

**Traducción:** el caso de voz son **dos adaptadores, una ruta, una página y un
normalizador**. Nada del cerebro se toca.

---

## 2. Hallazgo medido que condiciona la agenda (no el diseño)

Medido el 13 de septiembre en la laptop de desarrollo, contra Ollama real:

```
llama3.1:8b · prompt de juguete (171 tok in / 57 tok out) → 94 segundos
ollama ps → 5.6 GB del modelo, PROCESSOR = 58%/42% CPU/GPU
GPU = RTX 3050 Laptop (4 GB VRAM) · RAM = 32 GB
```

**Causa:** el modelo de 5.6 GB no cabe en 4 GB de VRAM, así que el 58 % corre en CPU.
No es un problema de configuración de Ollama ni del código: es el tamaño del modelo
contra la VRAM disponible. El system prompt real (`lib/agent/prompt.ts`, 9.4 KB ≈ 2.5k
tokens) más el contexto y las tools hacen que un turno real sea **bastante más lento que
esos 94 s**.

### Qué implica y qué NO implica

- **No bloquea el canal de texto.** Decisión ya tomada por el equipo: Ollama es banco de
  pruebas sin cuota; la demo corre en Gemini Flash / Groq, que están verificados y son
  rápidos. La lentitud se acepta a cambio de iterar sin quemar las 20 peticiones diarias.
### Resuelto el mismo día: `qwen2.5:3b`

El modelo de 3B entra completo en la VRAM disponible. Medido, mismo prompt, misma laptop:

| | `llama3.1:8b` | `qwen2.5:3b` |
|---|---|---|
| `ollama ps` → PROCESSOR | 58%/42% CPU/GPU | **100% GPU** |
| Turno en caliente | 94.112 ms | **756 ms** (~124× más rápido) |
| Generación | ~0.6 tok/s | **72.6 tok/s** |
| Tool-calling con el schema real | — | ✅ `{tipo: "mover_fecha", diaAcordado: 16}` en 948 ms |

**Regla operativa revisada, en dos niveles:**

1. **Probar el pipeline (cableado, latencia por etapa, persistencia): Ollama sirve.**
   756 ms de LLM deja un presupuesto de turno razonable para voz.
2. **Ensayar calidad conversacional o grabar tomas: `LLM_PROVIDER=gemini`.** La velocidad
   se arregló; la calidad no (ver abajo). Lo que un 3B diga no predice lo que dirá el
   modelo del demo, y la calidad conversacional vale 20 puntos.

> **Criterio general, no solo para esta laptop:** el modelo tiene que caber **completo en
> VRAM**, no en RAM. `ollama ps` debe decir `100% GPU`. Si dice algo como `58%/42%`, el
> modelo es muy grande para esa GPU y el turno se degrada dos órdenes de magnitud.

### Nota de calidad, no solo de velocidad

La respuesta que devolvió `llama3.1:8b` en esa medición:

> *"Lo siento, Karla. **Puedes** pagar la cuota de $145.00 en cuotas más pequeñas.
> ¿**Quieres** dividir la cuota en 2 pagos de $72.50...?"*

Dos fallas en una sola respuesta: **tuteo en vez de voseo** (*podés / querés* — y el
voseo pesa dentro de los 20 puntos de calidad conversacional) y una opción que **no está
en la escalera** (partir la cuota en dos pagos).

`qwen2.5:3b` es más rápido pero no mejor en esto — en su medición se le escapó
**portugués** (*"para **não** comprometer"*) y dio un consejo genérico sin ofrecer ningún
escalón. Es exactamente lo que advierten los dos docs de selección de modelo sobre los
modelos chicos, y refuerza la regla ya escrita: **la batería de 20 ataques se corre sobre
el modelo que de verdad se va a usar en el demo**, no sobre el que se usó para iterar.

**Contención estructural (lo que hace que esto sea tolerable):** `lib/agent/tools.ts` ya
está diseñado para que el modelo no pueda equivocar los datos duros — *"el modelo manda
lo MÍNIMO y el código deriva el resto"*. No manda el escalón (se deriva de `tipo`), no
manda la fecha (manda un día y el código la calcula), y `tipo` se valida contra
`opcionesValidasPara(cliente)`. Un modelo chico puede redactar mal; **no puede inventar
un escalón, una fecha ni una opción inexistente.**

**Bug real encontrado con este cambio (ya corregido):** `qwen2.5:3b` manda `monto: null`
en vez de omitir el campo, y el schema Zod usaba `.optional()`, que acepta `undefined`
pero rechaza `null` → `registrarAcuerdo` fallaba **justo en el turno de cierre**. Ahora
usa `.nullish()`. Es la clase de falla que solo aparece corriéndolo, como las seis de
[`estado-del-agente.md`](../../../docs/estado-del-agente.md).

---

## 3. Arquitectura: repetir el patrón que ya funciona

`lib/agent/llm.ts` define `LlmProvider` + `obtenerLlmProvider()` leyendo `LLM_PROVIDER`.
Ese patrón es lo que hace verdadera la frase del pitch *"cambiar de proveedor es cambiar
un archivo"*. **Las tres etapas usan la misma forma**, así que la frase aplica al
pipeline completo y no solo al LLM:

```ts
// voice/pipeline/stt.ts
export interface SttProvider {
  readonly nombre: string;
  transcribir(audio: ArrayBuffer, mime: string): Promise<{ texto: string; latenciaMs: number }>;
}
export function obtenerSttProvider(): SttProvider;   // lee STT_PROVIDER

// voice/pipeline/tts.ts
export interface TtsProvider {
  readonly nombre: string;
  sintetizar(texto: string): Promise<{ audio: ArrayBuffer; mime: string; latenciaMs: number }>;
}
export function obtenerTtsProvider(): TtsProvider;   // lee TTS_PROVIDER
```

Variables nuevas en `.env.example`: `STT_PROVIDER`, `TTS_PROVIDER`, más las credenciales
de cada uno cuando se activen (`DEEPGRAM_API_KEY`, `GOOGLE_TTS_*`).

### La única bifurcación real de diseño: dónde corre el STT

| | STT en el navegador (Web Speech) | STT en el servidor (Deepgram / Whisper) |
|---|---|---|
| Qué viaja a `/api/voz` | Texto ya transcrito + metadatos | El audio crudo |
| Setup | **Cero** — ni API key ni backend | API key (Deepgram) o binario local (Whisper) |
| Transcripción autoritativa | La produce el cliente (menos confiable como evidencia) | La produce el servidor ✅ |
| Cuándo conviene | Cerrar el loop hoy mismo | Demo y evidencia ante el jurado |

**Resolución:** la ruta acepta **las dos formas** desde el principio, con una unión
discriminada de Zod — el mismo patrón que ya usa `/api/chat` con `accion: 'iniciar' |
'mensaje'`. Así la Fase 1 arranca sin instalar nada y la Fase 2 solo cambia el `from`
sin tocar la página ni el orquestador.

---

## 4. Orden de construcción

Cada fase termina en algo **verificable**, no en código a medias.

### Fase 0 — Preparación (~15 min)
- Confirmar la regla: ensayos de voz con `LLM_PROVIDER=gemini`.
- (Opcional) `ollama pull qwen2.5:3b` y medir, si se quiere Ollama también para voz.
- **Listo cuando:** un turno de texto responde en segundos con el proveedor de ensayo.

### Fase 1 — Cerrar el loop en el navegador (~2 h)
Sin instalar nada, sin API keys nuevas.
- `app/api/voz/route.ts`: clona la lógica de `/api/chat`, pero crea la conversación con
  `canal: 'voz'`, `modoVoz: 'pipeline'` y llama al mismo `ejecutarTurno()`.
- `app/voz/[cliente]/page.tsx` + componente cliente: **push-to-talk** (botón mantener
  para hablar), `SpeechRecognition` para transcribir, `SpeechSynthesis` para reproducir.
- **Listo cuando:** una conversación hablada completa de Karla queda en la base con
  `canal='voz'`, `modo_voz='pipeline'`, su transcripción en `turnos` y su fila en
  `acuerdos` — igual que el flujo de texto ya verificado.

### Fase 2 — Adaptadores de verdad (~2 h)
- `voice/pipeline/stt.ts` → Deepgram (crédito $200, Nova-3).
- `voice/pipeline/tts.ts` → Google Cloud TTS Neural2 español.
- **Normalizador de texto antes del TTS** (ver §5).
- **Listo cuando:** el mismo flujo de Fase 1 corre con `STT_PROVIDER=deepgram` y
  `TTS_PROVIDER=google`, cambiando solo `.env.local`.

### Fase 3 — Instrumentación por etapa (~1 h, **bloqueada**)
El contrato de `voice/README.md` §3 pide desglose de latencia por etapa, pero `turnos`
solo tiene `latencia_ms`. Falta una migración con cuatro columnas nullable
(`latencia_stt_ms`, `latencia_llm_ms`, `latencia_validador_ms`, `latencia_tts_ms`).

> ⛔ **No correr esta migración todavía.** Hay una corrección de base de datos pendiente
> de un tercer origen; meter una migración ahora provoca un cuarto conflicto. Mientras
> tanto el desglose viaja en la respuesta de la API y el dashboard usa `latencia_ms`
> total, que es el campo común con S2S de todas formas.

### Fase 4 — Ensayo y ataque por voz
- Correr la batería (`npm run ataque`) sobre el modelo del demo.
- Un ensayo cronometrado del caso de voz, con latencia por etapa registrada.

---

## 5. El normalizador: barato y es un argumento de venta

El análisis comparativo (Dimensión 4.2) marca como ventaja de la cascada que existe un
paso de texto donde normalizar antes de sintetizar. S2S no lo tiene. Concretamente:

| Escrito (se persiste así) | Hablado (va al TTS) |
|---|---|
| `$145.00` | *ciento cuarenta y cinco dólares con cincuenta centavos* |
| `el 16` | *el dieciséis* |
| `DUI` | *dui* (no "de-u-i") |
| `Bancoagrícola` | acentuación correcta, no "Banco Agrícola" partido |

**Orden que importa:** validador → persistencia del texto escrito → normalizador → TTS.
El normalizador es cosmético y fonético; nunca puede cambiar el contenido que el
validador aprobó, y la transcripción que ve el jurado es la forma escrita.

Dato que respalda que esto no es teórico: el validador ya tuvo un bug donde `"$145.00"`
contaba como dos frases por el punto decimal, y el mensaje de cierre **siempre** menciona
el monto (`estado-del-agente.md`, aprendizaje #4). Los montos están en todos los turnos
importantes.

---

## 6. Fuera de alcance, a propósito

Declarado para que nadie lo construya "por si acaso" — cada uno cuesta horas y ninguno
suma puntos de rúbrica en este demo:

| Descartado | Por qué |
|---|---|
| **VAD / detección de fin de turno** | Push-to-talk lo reemplaza. El banco aceptó 4–5 s de latencia: no hay que pelear milisegundos |
| **Barge-in (interrumpir al agente)** | Solo tiene sentido con streaming continuo; con push-to-talk no aplica |
| **Streaming parcial hacia el TTS** | **Prohibido por la arquitectura**: el validador corre antes de sintetizar. Ya analizado en `critical-analysis-gemini-proposal.md` |
| **Telefonía / SIP / Twilio** | Es la respuesta de producción, no del demo. Se contesta hablando, no construyendo |
| **ElevenLabs para iterar** | 10k caracteres/mes se agotan en una tarde. Reservado para las tomas finales del pitch |

---

## 7. Riesgos abiertos

| Riesgo | Mitigación |
|---|---|
| Google Cloud TTS exige proyecto GCP con facturación habilitada aun en el tier gratis (a diferencia de AI Studio, que no pide tarjeta) | Verificarlo **antes** de la Fase 2. Si pide tarjeta y el equipo no quiere darla: Piper local es el plan B y corre en CPU en tiempo real |
| `SpeechSynthesis` suena robótico y choca con el guardrail de tono cálido | Solo se usa en Fase 1 para cerrar el loop. Nunca en el pitch |
| Web Speech API necesita internet y es de Chrome | Es andamiaje de desarrollo, no el demo |
| Voz y texto compiten por la misma cuota de Gemini | Ensayar voz consume cuota igual que texto. Contarlo dentro del presupuesto de 20 peticiones/modelo/día |
