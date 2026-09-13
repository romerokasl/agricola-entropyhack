# La señal de riesgo: cómo el modelo alimenta la conversación

> Última verificación: **13 de septiembre de 2026**, con `ml/api.py` levantado de verdad.
> Los números de este documento salieron de correr `npm run riesgo:demo`.

Hasta ahora el modelo predictivo (`ml/`) y el agente conversacional (`lib/agent/`) eran
dos sistemas que no se hablaban. El modelo tenía su microservicio y sus endpoints; el
agente leía una columna estática (`clientes.riesgo_banda`) sembrada por el seed. La
salida del modelo no llegaba nunca a una conversación.

Este documento describe la capa que los conecta: **`lib/riesgo/`**.

---

## En una línea

`lib/riesgo` produce una **señal de riesgo** por conversación, la misma para el canal de
texto y para el de voz, combinando tres vistas del cliente; el agente la usa para decidir
**a quién contactar y por dónde empezar**, y la señal queda guardada con la conversación
para que el dashboard pueda explicarla.

```
Cliente (fila de Postgres)
   │
   ├─ features.ts ──→ ml/api.py /predict ──→ vista 1: modelo vivo
   ├─ clientes.riesgo_score ───────────────→ vista 2: score de lote
   └─ reglas.ts (calendario salvadoreño) ──→ vista 3: reglas locales
                                                  │
                                       máximo de las tres
                                                  │
                                            SenalRiesgo
                                                  │
            ┌─────────────────┬───────────────────┼──────────────────┐
            ▼                 ▼                   ▼                  ▼
      diagnosticar()   opcionesValidasPara()  construirContexto()  conversaciones
      ¿se contacta?    qué se desbloquea      por dónde empezar    (auditoría)
                                                  │
                                    ┌─────────────┴─────────────┐
                                    ▼                           ▼
                            canal de texto              canal de voz
                            app/api/chat                voice/pipeline · s2s
```

---

## Las tres vistas, y por qué son tres

| Vista | De dónde sale | Qué ve | Qué NO puede ver |
|---|---|---|---|
| **Modelo vivo** | `ml/api.py` `/predict`, llamado en el momento | Apalancamiento y atrasos, derivados de la fila | Todo lo que no esté en esa fila |
| **Score de lote** | `clientes.riesgo_score` | El historial completo del cliente | Lo que pasó desde la última corrida |
| **Reglas locales** | `lib/riesgo/reglas.ts` | Quincena, remesa, débito automático, atraso | Cualquier señal financiera |

La segunda **no es redundante** con la primera. La llamada en vivo solo puede mandar lo
que hay en la fila, y el esquema de `clientes` no guarda ingreso, ni serie de ahorro, ni
historial de pagos (ver `lib/riesgo/features.ts`). El proceso de lote sí corre sobre esa
historia, así que ve cosas que la llamada en vivo no puede ver: la estacionalidad del
negocio de Rosa, la tendencia de Nelson subiendo su extrafinanciamiento cuatro meses
seguidos, la liquidez apretada de Sandra.

**Esto se midió, no se supuso.** Al construir la capa, la primera versión descartaba el
score de lote cuando el servicio respondía. Resultado: Sandra, Rosa y Nelson salían del
conjunto de contacto — tres de los ocho casos del pitch. Por eso la señal conserva las
tres vistas.

### Por qué el máximo y no el promedio

Es un sistema de **alerta temprana**: que una sola vista se encienda ya justifica una
conversación. Promediarlas las diluye. Las tres se guardan por separado, así que la
consola interna siempre puede decir cuál la disparó.

---

## Lo que el modelo aporta y lo que NO

El servicio devuelve, además de los números, dos textos ya redactados:

```json
"suggestedSolution": "Readecuación preventiva inmediata vía app móvil sin afectar calificación bancaria.",
"empatheticMessage": "Hemos preparado una propuesta de readecuación personalizada con menor cuota y mayor plazo a tu medida."
```

**Esos textos se descartan en `lib/riesgo/servicio.ts` y nunca llegan a una
conversación.** Rompen tres guardrails del banco a la vez: prometen un beneficio que no
existe ("sin afectar calificación bancaria"), inventan un producto a medida, y saltan
directo al escalón 7 de la escalera sin haber preguntado nada.

> **El modelo aporta la señal. Las palabras las pone el agente, con las opciones que
> calcula `lib/agent/ladder.ts`.**

Hay una prueba de regresión que lo verifica sustituyendo `fetch`: *"Del servicio de ML se
toman los números y se descarta el texto"* (`npm run verify:reglas`).

De los factores explicativos, al prompt solo entran los de origen `reglas` — los
escribimos nosotros en español llano. Los del modelo vienen con vocabulario de riesgo
("utilización de línea de crédito", "ratio deuda/ingreso"), y meterlos en el prompt sería
darle al modelo justo las palabras que el banco prohibió. Van a la base de datos y a la
consola interna, no a la conversación.

---

## Lo que se observa y lo que no

`lib/riesgo/features.ts` es el único archivo que hay que cambiar cuando el banco conecte
datos reales. Hoy declara explícitamente lo que no puede observar en vez de inventarlo:

| Feature | Estado |
|---|---|
| `creditLineUtilization` | **Derivada** de `saldo`/`cuota`, normalizada al plazo del producto |
| `latePaymentsLast6m` | **Derivada** del atraso actual + la desalineación estructural (12 fallos al año = 6 por semestre) |
| `daysUntilNextPayment` | **Observada**, acotada a [1, 45] porque fuera de ese rango `ml/api.py` responde 422 |
| `monthlyIncome` | **No observable** — el esquema no guarda ingreso |
| `debtToIncomeRatio` | **No observable** — se manda el neutro del servicio, no un DTI fabricado |
| `savingsDropPct` | **No observable** — no hay serie de ahorro conectada |
| `recentPaymentDifference` | **No observable** — no hay historial de pagos conectado |

Las cuatro últimas viajan en `senal.noObservadas`. Un número inventado que se ve igual
que uno medido es peor que un hueco declarado.

---

## Qué puede y qué no puede hacer la señal

| Puede | No puede |
|---|---|
| Abrir una conversación por riesgo cuando no hay atraso ni desalineación | Apagar un contacto que el atraso o la desalineación ya justificaban |
| Desbloquear el escalón 7 (reestructura) ante estrés sostenido | Agregar una opción que no esté en la escalera |
| Sugerir el escalón **mínimo** por el que empezar | Obligar a un escalón caro "por si acaso" |
| Cambiar la prioridad de acompañamiento | Aparecer en el texto que lee o escucha la persona |

Las cuatro filas de la derecha tienen prueba propia en `npm run verify:reglas`.

---

## Resultado medido (13 sep 2026, con el servicio levantado)

```
persona   vivo  lote regla  final  banda          fuente             esc  motivo de contacto
karla       59    62    58     62  MODERATE_HIGH  score_registrado     2  desalineacion_quincena
jose        68    58    56     68  MODERATE_HIGH  modelo_vivo          2  desalineacion_remesa
wilber      32    68    36     68  MODERATE_HIGH  score_registrado     1  atraso
sandra      15    56    18     56  MODERATE_HIGH  score_registrado     1  riesgo_alto
rosa        25    64    30     64  MODERATE_HIGH  score_registrado     1  riesgo_alto
nelson      30    59    18     59  MODERATE_HIGH  score_registrado     1  riesgo_alto
tito        30    51    24     51  MODERATE       score_registrado     1  atraso
marta       23     8     4     23  LOW            modelo_vivo          1  — (no se contacta)
```

- **El control se mantiene.** Marta sigue fuera del conjunto de contacto, y se deriva de
  sus datos: puntúa bajo en las tres vistas.
- **El modelo vivo aporta de verdad.** En José sube la señal por encima del score de
  lote (68 contra 58).
- **Latencia medida:** 2–4 ms por cliente contra el servicio local (67 ms la primera
  llamada, que incluye levantar la conexión). El presupuesto era 1,500 ms.
- El servicio corrió **sin `model_abcd.pkl`** (es un artefacto de entrenamiento, no está
  versionado), así que respondió con su heurística interna. La señal lo registra:
  `modeloVersion = "Heuristic-Fallback (heurística del servicio)"`. Con el `.pkl`
  presente, la columna `vivo` cambia y nada más se toca.

**Sin el servicio de Python levantado el flujo no cambia:** la señal cae al score de lote
y las bandas quedan idénticas. Verificado con `npm run riesgo:demo` en los dos estados.

---

## Cómo la consume la voz

La conversación no vive en la ruta HTTP: vive en **`lib/agent/sesion.ts`**, que no sabe
de canales. `app/api/chat/route.ts` es un envoltorio delgado sobre esas dos funciones, y
el orquestador de voz va a ser otro envoltorio sobre las mismas:

```ts
import { iniciarConversacion, continuarConversacion } from "@/lib/agent/sesion";

// Canal de voz, enfoque pipeline (STT → LLM → validador → TTS)
const inicio = await iniciarConversacion({
  slug: "karla",
  apertura: "agente",
  canal: "voz",
  modoVoz: "pipeline",   // o "s2s"
});
// inicio.turnos[0].texto → lo que se manda al TTS, ya validado

const respuesta = await continuarConversacion({
  conversacionId: inicio.conversacionId,
  texto: transcripcionDelSTT,
});
```

Con eso, los dos enfoques de voz heredan gratis la señal de riesgo, la escalera, el
validador determinista y las mismas tablas — que es exactamente lo que exige el contrato
de [`voice/README.md`](../voice/README.md). Lo único que cambia entre canales es un
bloque de guía de redacción (`GUIA_DE_VOZ` en `lib/agent/prompt.ts`): por teléfono la
persona escucha, no lee, así que no se enumeran opciones ni se dice "escribime". **Las
reglas y las opciones válidas son idénticas**, y hay una prueba que lo verifica.

---

## Trazabilidad: qué queda guardado

La migración `20260913120000_senal_riesgo_en_conversaciones.sql` agrega a
`conversaciones`:

| Columna | Para qué |
|---|---|
| `riesgo_score`, `riesgo_banda` | La señal con la que se abrió |
| `riesgo_componente_modelo_vivo` · `_registro` · `_reglas` | Las tres vistas por separado |
| `riesgo_fuente` | Cuál de las tres produjo el score |
| `riesgo_clase_ssf` | La clase NCB-022 predicha |
| `escalon_sugerido` | Por dónde se le dijo al agente que empezara |
| `riesgo_factores` | Los factores que explican la señal, con su origen |
| `motivo_contacto` | **Por qué se abrió.** No se guardaba antes |

El scorer corre **una sola vez por conversación**, al abrir. Los turnos siguientes reusan
la señal guardada: llamar al servicio por turno le sumaría latencia a una respuesta que
la persona está esperando, y además haría que la conversación no tuviera una única señal
que la explique.

Con esto el dashboard puede contestar preguntas que antes no tenía cómo: acuerdos
cerrados por banda de riesgo, cuántas conversaciones las abrió el modelo contra cuántas
las abrió el calendario salvadoreño, y tasa de cierre por motivo de contacto.
