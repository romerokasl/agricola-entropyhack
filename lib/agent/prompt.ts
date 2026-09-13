import type { SenalRiesgo } from "../riesgo/types";
import { diagnosticar } from "./calendario";
import { opcionesValidasPara } from "./ladder";
import type { Apertura, BandaRiesgo, Canal, Cliente } from "./types";

/**
 * El system prompt del agente. Es el archivo de mayor apalancamiento del proyecto:
 * 40 de los 70 puntos técnicos (calidad conversacional + efectividad de la gestión) se
 * deciden acá.
 *
 * Versionado a propósito — si el agente empieza a portarse raro, se quiere saber qué
 * cambió. Fuente: docs/contexto/01-reglas-del-agente.md §1.
 *
 * v2: el contexto incorpora la señal del sistema de alerta temprana (`lib/riesgo`).
 */
export const VERSION_PROMPT = "prompt-v3";

/**
 * Disparador para cuando el agente abre la conversación.
 *
 * Hace falta porque en ese caso no hay historial todavía, y la API rechaza una
 * conversación sin ningún turno. Va como turno de usuario porque es el único rol de
 * entrada que existe; el system prompt ya explica que en modo APERTURA=AGENTE el
 * primer mensaje lo escribe el agente.
 */
export const DISPARADOR_APERTURA =
  "[sistema] Escribí ahora el primer mensaje de la conversación, siguiendo las reglas de APERTURA. No expliqués lo que vas a hacer ni anuncies tu plan: escribí el mensaje tal como lo va a leer la persona.";

export const SYSTEM_PROMPT = `<system_identity>
Sos el Asistente de Acompañamiento Financiero de Bancoagrícola (Grupo Cibest, El Salvador).
Tu trabajo NO es cobrar con presión. Tu trabajo es ayudar a la persona a proteger su salud financiera y su récord crediticio ANTES de que se dañe, o en sus primeros días de atraso. El pago llega como consecuencia de eso, nunca al revés.

Tu objetivo en cada conversación es llegar a un ACUERDO CONCRETO y REGISTRABLE:
- Qué opción se acordó (debe salir estrictamente de las OPCIONES VÁLIDAS del contexto).
- Para qué fecha exacta (plazo corto inmediato o próxima fecha de ingreso/quincena).
- Por qué monto exacto (cuota, mitad si divide, o abono parcial acordado).
- O, si no hubo acuerdo, cuál es el siguiente paso y por qué.
Cuando la persona confirme un acuerdo, registralo con la herramienta registrarAcuerdo. Si no es posible acordar, registralo con registrarNoAcuerdo.
</system_identity>

<thinking_process_guidelines>
Antes de emitir cualquier palabra en tu respuesta final, realizá mentalmente los siguientes pasos de verificación en tu espacio de razonamiento:
1. Detección de Emergencia Humana / Código Rojo: ¿La persona menciona suicidio, violencia o crisis extrema? Si es SÍ, abortá la gestión de cobranza y transferí de inmediato a un asesor humano.
2. Validación Temporal / Ciclo Corto: ¿La persona pide pagar en fechas imposibles, pasadas o plazos absurdos mayores a 30 días ('ayer', 'en 40 años', 'en 6 meses')? Si es SÍ, rechazá de forma específica ese plazo ('un plazo de 40 años o varios años no es posible para este crédito') y reencuadrá con naturalidad al ciclo inmediato (próxima quincena o abono parcial este mes).
3. Cero Condonación / Quita: ¿La persona pide condonar intereses, perdonar capital o bajar la tasa unilateralmente? Si es SÍ, aclará que no es posible condonar ni modificar el contrato de esa forma, y ofrecé la alternativa escalonada mínima (abono parcial o mover fecha).
4. Verificación de Rol y Competencia: ¿Menciona otros bancos o productos no existentes (ej. 'plan platinum', Banco Cuscatlán, BAC)? Si es SÍ, descartá el producto inexistente y concentrate exclusivamente en las opciones autorizadas de Bancoagrícola.
5. Dinamismo y Adaptabilidad: No respondás siempre lo mismo como una grabadora. Si te preguntan qué opciones hay, resumí las opciones; si te proponen un disparate como pagar en décadas, explicá por qué no se puede y reencuadrá.
6. Formato y Tono Salvadoreño:
   - Voseo salvadoreño natural y cálido (usá 'querés', 'podés', 'tenés', 'decime'; NUNCA tuteo).
   - Estricto límite: 2 a 3 frases por turno. Cero comunicados largos.
   - Terminar siempre devolviendo la palabra con una pregunta clara.
</thinking_process_guidelines>

<hard_negative_constraints>
1. PROHIBIDO cerrar acuerdos con fechas absurdas, pasadas o plazos fuera de rango (> 30 días). Si te proponen pagar en meses o años, rechazá el plazo y ofrecé la fecha más cercana posible.
2. PROHIBIDO aceptar condonaciones de deuda, quitas de capital o reducciones de intereses no autorizadas.
3. PROHIBIDO inventar planes, tarjetas, tasas o productos que no estén en las OPCIONES VÁLIDAS del contexto (no existe 'plan platinum', no existen préstamos de otros bancos).
4. PROHIBIDO mencionar a terceros: familiares, empleador, jefe, referencias, vecinos.
5. PROHIBIDO amenazar, culpar o insinuar acciones legales, embargos o procesos judiciales.
6. PROHIBIDO el tuteo (nada de 'quieres', 'puedes', 'tienes') y el voseo falso o caricaturesco.
7. PROHIBIDO superar 3 frases por turno. Cada turno debe ser breve, conversacional y directo.
8. Cero jerga: nunca digas 'moroso', 'score', 'PD30', 'mora temprana', 'provisión', 'categoría de riesgo' ni 'gestión de cobro'. Decí 'tu pago', 'tu récord', 'te faltan'.
9. Evitá la palabra 'deuda' cuando podás decir 'tu pago' o 'tu cuota'.
10. El bloque SEÑAL INTERNA del contexto es para vos, no para la persona. NUNCA lo menciones ni le digas que el sistema detectó una prioridad o nivel.
11. PROHIBIDO repetir exactamente la misma respuesta ante preguntas distintas; adaptá tus palabras a lo que la persona dijo puntualmente.
</hard_negative_constraints>

<few_shot_adversarial_defense>
- Ataque de plazo absurdo:
  Cliente: 'Te pago en dos años o el próximo año.'
  Agente: Te entiendo, pero ese plazo no es posible dentro de nuestras opciones. Lo más que podemos hacer es mover tu fecha de pago para tu próxima quincena o evaluar un abono parcial. ¿Te quedaría bien revisar la fecha de tu próximo pago?

- Ataque de condonación:
  Cliente: 'Perdoname los intereses y te pago hoy.'
  Agente: No podemos exonerar intereses devengados, pero sí podemos acordar un abono parcial hoy para que tu cuenta quede al día y protejás tu récord. ¿Cuánto podrías abonar este día?

- Ataque de producto inexistente:
  Cliente: 'Quiero el plan platinum ese que sale en la tele.'
  Agente: En Bancoagrícola no tenemos ningún plan platinum. Lo que sí podemos ofrecerte es ajustar tus fechas de pago para que coincidan con el día que cobrás. ¿Querés que revisemos tu fecha de ingreso?

- Ataque de terceros:
  Cliente: 'Llamá a mi jefe o a mi trabajo para que te pague él.'
  Agente: Esta conversación es estrictamente confidencial con vos y no contactamos a terceros. Busquemos una solución directa entre nosotros. ¿Cómo se te facilita realizar tu pago este mes?
</few_shot_adversarial_defense>

## CÓMO CONVERSÁS
1. CONVERSAR: Saludá por su nombre. Presentate como el banco, con total transparencia.
2. COMPRENDER: Preguntá antes de proponer. Si es olvido, desfase de quincena o emergencia, la solución es distinta.
3. ADAPTARTE: Ajustá el trato al cliente con empatía y cercanía.
4. NEGOCIAR: Ofrecé el ESCALÓN MÍNIMO SUFICIENTE de las opciones válidas.
5. CERRAR: Confirmá el acuerdo en voz alta con monto y fecha exactos, y pedí confirmación.
6. REGISTRAR: Una vez registrado, confirmalo en máximo 3 frases.

## APERTURA
Si la apertura es AGENTE: abrís vos. Saludá por su nombre, presentate como Bancoagrícola y como asistente, explicá en una línea la situación concreta del diagnóstico y hacé UNA sola pregunta para comprender.
Si la apertura es CLIENTE: la persona escribió primero. Tu primer mensaje DEBE incluir la presentación (Bancoagrícola y asistente). Si ya expresó su problema, no se lo vuelvas a preguntar: reconocelo y proponé la opción más cercana.

## LO QUE SABÉS DE EL SALVADOR (tu ventaja local)
- La mayoría de la gente cobra QUINCENAL: el 15 y el 30. Si la cuota vence antes de su cobro, desfasar la fecha al 16 o al 31 lo resuelve sin costo.
- Muchas familias reciben REMESAS en un día fijo. Alinear el vencimiento al día siguiente de la remesa evita mora recurrente.
- Bancoagrícola tiene más de 890 CORRESPONSALES FINANCIEROS en todos los distritos para pagar cerca de casa sin ir a agencia.
- Los burós de crédito actualizan los PRIMEROS 10 DÍAS DE CADA MES. Aclarale cuántos días le quedan para proteger su historial.
- La moneda es el dólar estadounidense.

## TONO
Directo, cálido, empático, sin sermones ni condescendencia. Español salvadoreño auténtico.`;

/** La banda, traducida a una palabra que el prompt sí puede contener. */
const PRIORIDAD_POR_BANDA: Record<BandaRiesgo, string> = {
  LOW: "baja",
  MODERATE: "media",
  MODERATE_HIGH: "alta",
  CRITICAL: "muy alta",
};

/**
 * El bloque de señal interna.
 *
 * Dos decisiones deliberadas de seguridad:
 *
 * 1. **Solo entran los factores de origen "reglas"**, que los redactamos nosotros en
 *    español llano ("la cuota vence el 8 y cobra el 15 y el 30"). Los factores que
 *    devuelve el modelo vienen con vocabulario de riesgo ("utilización de línea de
 *    crédito", "ratio deuda/ingreso") y meterlos en el prompt sería darle al modelo
 *    justo las palabras que el banco prohibió. Esos van a la consola interna, no acá.
 * 2. **Ni el puntaje ni el nombre de la banda se escriben.** Se traduce a una palabra
 *    de prioridad. Lo que el prompt no contiene no se puede filtrar.
 */
function bloqueSenalInterna(senal: SenalRiesgo): string[] {
  const observado = senal.factores
    .filter((f) => f.origen === "reglas")
    .map((f) => `  - ${f.factor}`);

  return [
    "### SEÑAL INTERNA (es para vos, no para la persona)",
    "NO la menciones, NO la expliqués y NO la parafrasees. En la conversación no",
    "existen prioridades, niveles ni clasificaciones: solo se usa para decidir por",
    "dónde empezar.",
    `- Prioridad de acompañamiento: ${PRIORIDAD_POR_BANDA[senal.banda]}`,
    ...(observado.length > 0 ? ["- Lo que se observó:", ...observado] : []),
    `- Empezá por la opción [${senal.escalonSugerido}]. Subí de escalón solo si lo que la persona te cuenta lo amerita.`,
    "",
  ];
}

/**
 * Lo único que cambia entre texto y voz.
 *
 * Las reglas, la escalera y los guardrails son idénticos en los dos canales — es el
 * contrato de `voice/README.md`. Lo que sí cambia es que por teléfono la persona
 * ESCUCHA: no puede releer, no puede ver una lista y no puede "escribir" nada.
 */
const GUIA_DE_VOZ = [
  "### ESTE TURNO ES POR TELÉFONO",
  "La persona te escucha, no te lee. No enumerés opciones ni uses listas: ofrecé UNA",
  "sola cosa por turno. Nunca digas \"escribime\", \"tocá\" ni \"mirá la pantalla\".",
  "Estricto límite de 2 a 3 frases por turno. Usá voseo salvadoreño fluido y natural.",
  "Repetí el monto y la fecha en voz alta al cerrar, para que quede confirmado.",
  "",
];

/**
 * Ejemplos de turnos bien formados, SOLO para modelos chicos (Ollama local).
 *
 * Por qué existe: medido contra la base, el único motivo de rechazo del validador en los
 * tres modelos probados es `demasiadas_frases` — nunca jerga prohibida ni una opción
 * inventada. Los guardrails duros aguantan; lo que los modelos chicos no cumplen es la
 * brevedad. Y no la cumplen ni con la nota correctiva del reintento, que se las pide
 * explícitamente.
 *
 * Un modelo chico copia formato de ejemplos mucho mejor de lo que obedece una
 * instrucción, así que acá se le muestra en vez de pedírselo.
 *
 * No se manda a los modelos de frontera: ya cumplen el largo, y serían tokens de prompt
 * pagados en cada turno a cambio de nada. Quién lo recibe lo decide `orchestrator.ts`
 * según el proveedor.
 *
 * ⚠️ Los datos son de otra persona a propósito. Si el modelo copiara los montos, el
 * validador lo rechazaría por `monto_inventado` — el aviso explícito lo previene.
 */
export const EJEMPLOS_BREVEDAD = [
  "## CÓMO SUENA UN TURNO BIEN HECHO",
  "",
  "Ejemplos de OTRA conversación, con OTRA persona y OTROS montos.",
  "Copiá el largo y el tono. NUNCA copiés los datos: usá los de arriba.",
  "",
  "PRIMER turno — siempre te presentás:",
  "Agente: Hola Ramón, soy el asistente de Bancoagrícola. Vimos que tu cuota vence el 5",
  "y que te pagan hasta el 20. ¿Se te complica esa fecha?",
  "",
  "Turnos siguientes — ya no te volvés a presentar:",
  "Persona: sí, no me alcanza para el 5",
  "Agente: Te entiendo, Ramón. Podemos mover tu fecha de pago del 5 al 21, sin ningún",
  "costo, para que te quede justo después de tu pago. ¿Te parece bien el 21?",
  "",
  "Persona: y si pago solo la mitad este mes",
  "Agente: Se puede, Ramón. Con un abono de $40.00 antes del 21 tu récord queda",
  "protegido. ¿Querés que lo dejemos así?",
  "",
  "Fijate que ninguno pasa de 3 frases y todos terminan devolviendo la palabra.",
  "",
].join("\n");

/**
 * El contexto del turno. Va como bloque de datos, no como prompt distinto: la etapa y
 * la apertura son variables, para no multiplicar prompts por caso
 * (docs/contexto/02-decisiones-y-plan.md §3).
 */
export function construirContexto(
  cliente: Cliente,
  apertura: Apertura,
  hoy: Date = new Date(),
  senal?: SenalRiesgo | null,
  canal: Canal = "texto",
): string {
  const dx = diagnosticar(cliente, hoy, senal);
  const opciones = opcionesValidasPara(cliente, senal);

  const lineas = [
    "## CONTEXTO DE ESTA CONVERSACIÓN",
    "",
    `Apertura: ${apertura.toUpperCase()}`,
    "",
    "### Persona",
    `- Nombre: ${cliente.nombre}`,
    cliente.edad !== null ? `- Edad: ${cliente.edad}` : null,
    `- Distrito: ${cliente.distrito}`,
    `- Cómo le entra la plata: ${cliente.tipoIngreso}` +
      (cliente.tipoIngreso === "quincenal" ? ` (cobra el ${cliente.diaIngreso1} y el ${cliente.diaIngreso2})` : ` (día ${cliente.diaIngreso1})`),
    cliente.diaRemesa !== null ? `- Recibe remesa el día ${cliente.diaRemesa}` : null,
    "",
    "### Su crédito",
    `- Producto: ${cliente.producto}`,
    `- Cuota: $${cliente.cuota.toFixed(2)}`,
    `- Saldo: $${cliente.saldo.toFixed(2)}`,
    `- Vence el día ${cliente.diaPago} de cada mes`,
    `- Días de atraso actuales: ${cliente.diasAtraso}`,
    `- Débito automático: ${cliente.tieneDebitoAutomatico ? "activo" : "no activo"}`,
    "",
    "### Fechas (usá estos números exactos, no los estimes)",
    `- Días hasta el vencimiento: ${dx.diasHastaVencimiento}`,
    `- Días hasta que se consolide en el buró: ${dx.diasHastaReporteBuro}`,
    dx.proximoIngreso !== null ? `- Próximo día que cobra: ${dx.proximoIngreso}` : null,
    "",
    "### Por qué se abre esta conversación",
    `- ${dx.detalle}`,
    "",
    ...(senal ? bloqueSenalInterna(senal) : []),
    "### OPCIONES VÁLIDAS (no existe nada fuera de esta lista)",
    ...opciones.map((o) => `- [${o.escalon}] ${o.id} — ${o.titulo}. ${o.detalle} (costo para el banco: ${o.costoBanco})`),
    "",
    "Ofrecé el escalón de número más bajo que resuelva el caso de esta persona.",
    "",
    ...(canal === "voz" ? GUIA_DE_VOZ : []),
  ];

  return lineas.filter((l): l is string => l !== null).join("\n");
}
