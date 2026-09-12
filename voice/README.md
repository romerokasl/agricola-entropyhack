# Voz — dos enfoques en paralelo, comparados de verdad

Este reto pide defender la decisión **pipeline (STT→LLM→TTS) vs. speech-to-speech**
ante el jurado (`docs/contexto/00-contexto-global.md` §6, `02-decisiones-y-plan.md` §1).
En vez de defenderla solo con argumentos, la vamos a defender con **dos
implementaciones reales corriendo lado a lado** y datos del dashboard.

Esta carpeta existe para que los dos enfoques se desarrollen **sin pisarse los
archivos entre sí**. Cada quien trabaja dentro de su carpeta; todo lo que es de
negocio, dato o UI y no depende del enfoque de voz **se sigue trabajando donde ya
vivía** (`lib/`, `app/`, `supabase/migrations/`, `ml/`, `docs/contexto/`) — no se
duplica ni se mueve.

```
voice/
├── README.md                    (este archivo — el contrato entre ambos enfoques)
├── pipeline/                    (STT → LLM → Validador → TTS)
│   ├── README.md
│   └── docs/
│       └── critical-analysis-gemini-proposal.md
└── speech-to-speech/            (S2S nativo / audio-to-audio)
    └── README.md
```

**Regla simple:** si el archivo describe *cómo suena o cómo se arma la respuesta de
voz*, va dentro de `pipeline/` o `speech-to-speech/`. Si describe *qué puede decir el
agente, a quién le habla o qué se guarda*, va en el código global — porque eso no
cambia según el enfoque.

---

## Qué es compartido y NO se duplica (una sola fuente de verdad)

| Qué | Dónde vive | Por qué es compartido |
|---|---|---|
| System prompt, reglas de negociación, guardrails, escalera de opciones | `docs/contexto/01-reglas-del-agente.md` + su implementación en `lib/agent/` | El contenido de negocio no cambia si el audio se genera por pipeline o por S2S |
| Esquema de datos (`clientes`, `conversaciones`, `turnos`, `acuerdos`) | `supabase/migrations/` | Ambos enfoques escriben a las mismas tablas — es la única forma de comparar de verdad |
| Tools tipadas (`consultarCliente`, `consultarOpcionesValidas`, `registrarAcuerdo`) | `lib/` (o equivalente Python en `ml/`) | Función de negocio, no de audio |
| Canal de texto (WhatsApp-like), UI del chat | `app/` | No es un canal de voz; ninguno de los dos enfoques lo toca |
| Dashboard y métricas | `app/` + tablas de Supabase | Tiene que mostrar **ambos enfoques comparados**, no uno solo |
| Scorer de riesgo (`/api/predict`) | `ml/` | Ya está congelado, no depende de voz |

## Qué es específico de cada enfoque (no se comparte)

- Integración con el proveedor de STT/TTS o con el proveedor de audio-to-audio
- Cómo y cuándo se dispara el validador (antes de hablar vs. en paralelo/streaming)
- Instrumentación de latencia propia de esa arquitectura (por etapa vs. round-trip único)
- Manejo de interrupciones/barge-in si aplica

---

## Contrato obligatorio para que la comparación sea justa

Para que el dashboard pueda comparar los dos enfoques sin casos especiales, **ambos
enfoques deben cumplir esto sin excepción**:

1. **Usar las mismas tools y el mismo contenido de reglas** — ninguno de los dos
   enfoques puede tener su propia copia de la escalera de opciones o de los límites
   de negociación. Un solo lugar, ambos lo consumen.
2. **Persistir cada turno en `conversaciones`/`turnos` con un campo `voice_mode`**
   (`'pipeline'` | `'speech_to_speech'`) — así el dashboard filtra y compara sin
   tocar el schema por enfoque.
3. **Registrar las mismas métricas por turno**: `latencia_ms`, `tokens_in`,
   `tokens_out` (si aplica), `validador_ok`, `modelo_version`. El pipeline puede
   además desglosar la latencia por etapa (STT/LLM/validador/TTS); S2S reporta el
   round-trip total. El dashboard debe poder graficar ambos con el mismo campo
   `latencia_ms` como base común.
4. **El validador determinista corre siempre, en los dos enfoques**, aunque el
   *cómo* difiera. Ninguno de los dos puede saltárselo — es el argumento central
   ante el jurado sobre control de alucinaciones.
5. **No tocar archivos fuera de tu carpeta** sin avisar. Si una tarea necesita
   cambiar algo compartido (schema, tools, prompt), se coordina antes — es la misma
   regla de "un dueño por archivo grande" que ya está en `CLAUDE.md`.

## Convención de ramas

- `feat/voice-pipeline-*` → cambios dentro de `voice/pipeline/`
- `feat/voice-s2s-*` → cambios dentro de `voice/speech-to-speech/`
- Cambios a lo compartido (`lib/`, `supabase/migrations/`, `docs/contexto/`) van en
  su propia rama chica y se avisan al otro antes de mergear, para no pisar trabajo.
