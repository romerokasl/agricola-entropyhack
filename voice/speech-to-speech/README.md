# Enfoque: Speech-to-Speech (audio-to-audio nativo)

Segunda opción de voz, construida para compararla con el pipeline con datos reales. Ver
el contrato compartido en [`../README.md`](../README.md).

**Proveedor:** OpenAI Realtime API, modelo `gpt-realtime-2.1` — la decisión de
[`docs/criterios-comparacion-voz.md`](../../docs/criterios-comparacion-voz.md) §8.

| | |
|---|---|
| Pantalla | `/s2s/[cliente]` (por ejemplo `/s2s/karla`, `/s2s/karla?apertura=cliente`) |
| API | `POST /api/voz-s2s` con `accion`: `iniciar`, `tool`, `turno` |
| Registro | `conversaciones.canal = 'voz'`, `modo_voz = 's2s'` — mismas tablas que texto y pipeline |
| Verificación sin red | `npm run verify:s2s` |

## Cómo levantarlo

```
# .env.local
OPENAI_API_KEY=sk-...          # obligatoria para este enfoque
OPENAI_REALTIME_MODEL=gpt-realtime-2.1   # opcional
OPENAI_REALTIME_VOICE=marin              # opcional
```

`npm run dev` y abrir `/s2s/karla` en Chrome o Edge. La llamada arranca con el botón
**Iniciar llamada** (el navegador no deja sonar audio sin un gesto) y después es
push-to-talk, igual que el pipeline, para que la comparación sea justa.

Sin `OPENAI_API_KEY`, `/api/voz-s2s` responde `503 S2S_NO_CONFIGURADO` **antes** de abrir
la conversación, así no queda una fila huérfana en la base.

---

## La pregunta que hay que responder: ¿dónde corre el validador?

El contrato exige que el validador determinista corra siempre, y un modelo audio-a-audio
no tiene un paso de texto entre el modelo y el parlante. Esta implementación lo resuelve
**reteniendo el audio**:

```
Navegador                         OpenAI Realtime              /api/voz-s2s
─────────                         ───────────────              ────────────
micrófono (PCM16 24 kHz) ───────► gpt-realtime-2.1
                                    │ audio de respuesta
audio RETENIDO, no suena ◄──────────┤
                                    │ transcripción de ese audio
                                    └────────────────────────► validar() — el MISMO de texto
                                                                 │
             ┌──────────────── pasa ─────────────────────────────┤ persiste el turno
             ▼                                                    │
         se reproduce                                             │
                                                                  │
             ┌───── no pasa (1.er intento) ───────────────────────┤ no persiste
             ▼                                                    │
   se borra el item + nota correctiva como mensaje de sistema → el modelo regenera
                                                                  │
             ┌───── no pasa (2.º intento) ────────────────────────┘ persiste la respuesta segura
             ▼
   se borra el audio del modelo · se dice la respuesta segura (texto fijo)
```

Es exactamente la política de `lib/agent/orchestrator.ts`: un reintento correctivo y
después la respuesta segura. La decisión está en `compuerta.ts`, en funciones puras que
`npm run verify:s2s` prueba sin red.

**Por qué WebSocket y no WebRTC**, que es lo que OpenAI recomienda para navegadores: con
WebRTC el audio del modelo llega como una pista que el navegador reproduce apenas llega.
No hay dónde retenerlo. Con WebSocket el audio llega como datos y la compuerta es posible.

### Lo que esto cuesta, dicho sin maquillaje

- **Se pierde el streaming de salida**, que es la ventaja principal de S2S. La persona
  escucha la respuesta cuando terminó de generarse y pasó el validador, no a los
  ~300–500 ms del primer byte. La pantalla muestra las dos cifras: *ida y vuelta* y
  *hasta que suena*.
- **Se valida la transcripción del audio, no el audio.** El modelo emite la transcripción
  de su propia salida junto con el audio. Es la misma generación, pero el proveedor no
  garantiza que sean idénticas palabra por palabra. En el pipeline se valida el texto y
  **después** se sintetiza exactamente ese texto; acá hay una capa de confianza más. Es la
  diferencia estructural honesta entre los dos enfoques.
- **El chequeo de montos depende de cómo transcribe.** El validador busca montos con
  `$`. Si la transcripción escribe "ciento cuarenta y cinco dólares" en palabras, ese
  monto no se verifica. En el pipeline el texto viene del LLM con formato controlado.
- **La respuesta segura suena con la voz del navegador**, no con la del modelo. Es texto
  fijo y no hace falta validarlo; pedirle al modelo que lo lea podría volver a fallar.

---

## Qué es compartido (no se reimplementó nada)

| Pieza | De dónde sale |
|---|---|
| Decisión de contacto, señal de riesgo, caso de control | `abrirConversacion` en `lib/agent/sesion.ts` |
| System prompt y contexto (con `GUIA_DE_VOZ`) | `lib/agent/prompt.ts`; S2S suma solo `GUIA_S2S` |
| Tools y su ejecución | `DECLARACIONES` y `ejecutarTool` de `lib/agent/tools.ts` |
| Validador y respuesta segura | `lib/agent/validator.ts` |
| Persistencia | `lib/db/conversaciones.ts` |

**Único cambio en código compartido:** `lib/agent/sesion.ts` ahora expone
`abrirConversacion`, que es la primera mitad de `iniciarConversacion` (señal, decisión de
contacto y fila) sin correr el primer turno con el LLM de texto. `iniciarConversacion` la
llama por dentro y se comporta igual que antes. Sin esta separación, S2S habría tenido
que copiar la decisión de contacto.

## Qué queda en `turnos`

| Campo | Valor en S2S |
|---|---|
| `latencia_ms` | Desde que la persona soltó el botón hasta que terminó de generarse la respuesta aceptada. Incluye herramientas y reintentos. Es el campo común con el pipeline |
| `latencia_validador_ms` | Medido en el servidor |
| `latencia_stt_ms`, `latencia_llm_ms`, `latencia_tts_ms` | `null`: S2S no tiene esas etapas separadas |
| `tokens_in`, `tokens_out` | Suma de **todas** las respuestas del turno, incluidas las que llamaron herramientas y las que rechazó el validador |
| `validador_ok`, `validador_motivo` | Misma semántica que texto: un reintento exitoso cuenta como intervención |
| `modelo_version` | `gpt-realtime-2.1/prompt-v2` |
| texto del turno de la persona | La transcripción de `gpt-4o-transcribe`, o `[sin transcripción]` si falló |

## Estructura

```
speech-to-speech/
├── README.md
├── config.ts          modelo, voz y transcripción desde el entorno (solo servidor)
├── protocolo.ts       eventos de la Realtime API, tools e instrucciones (isomórfico, puro)
├── audio.ts           Float32 ⇄ PCM16 base64, remuestreo (puro)
├── compuerta.ts       validar lo hablado y decidir: reproducir, reintentar o respuesta segura
├── servidor.ts        clave efímera, herramientas y registro del turno
└── cliente/
    └── llamada.ts     la llamada en el navegador: WebSocket, micrófono, audio retenido
```

La ruta es `app/api/voz-s2s/route.ts` y la pantalla `app/s2s/[cliente]/`.

---

## Límites conocidos

1. **No está probado contra OpenAI todavía.** Todo lo que no requiere red está verificado
   (`verify:s2s`, type-check, lint, build). La conexión real, la calidad del voseo y las
   latencias hay que medirlas con una API key.
2. **`temperature` no se puede fijar en 0.2.** La sesión de la Realtime API no expone ese
   parámetro, así que la recomendación del ingeniero del banco no aplica a este enfoque.
3. **Las instrucciones son visibles en el navegador.** El evento `session.created` las
   devuelve por el WebSocket, incluido el bloque de señal interna. En producción el
   WebSocket iría por un servidor propio o por SIP, no directo desde el navegador.
4. **Las métricas las mide el navegador.** La latencia y los tokens viajan desde el
   cliente porque es ahí donde ocurren los eventos. El validador y la persistencia sí
   corren en el servidor.
5. **Un turno de agente se puede registrar después del cierre.** El turno de confirmación
   llega después de que `registrarAcuerdo` cerró la conversación, así que el registro no
   exige que esté abierta. La pantalla bloquea hablar tras el cierre y la ruta de tools
   rechaza herramientas en una conversación cerrada.
6. **El dashboard no tiene precio para este modelo.** `lib/dashboard/precios.ts` usa un solo
   precio por token, y la Realtime API cobra distinto texto y audio ($32/$64 por millón en
   audio, $4/$24 en texto). Se muestra como "sin precio" en vez de estimarlo mal.
