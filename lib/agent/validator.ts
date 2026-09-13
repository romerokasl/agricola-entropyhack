import type { SenalRiesgo } from "../riesgo/types";
import { opcionesValidasPara } from "./ladder";
import type { Cliente, Turno } from "./types";

/**
 * Validador determinista. Corre en CADA respuesta antes de mostrarla, sin LLM.
 *
 * Es la respuesta real a "¿cómo controlan las alucinaciones?": el sampling nunca fue la
 * garantía — esto sí. Fuente: docs/contexto/01-reglas-del-agente.md §5.
 */

const PALABRAS_PROHIBIDAS = [
  "moroso", "morosa", "deudor", "deudora", "incumplimiento", "cobro judicial",
  "embargo", "reportado", "lista negra", "castigo", "sanción", "demanda",
  "score", "pd30", "provisión", "categoría de riesgo", "gestión de cobro",
  "mora temprana",
] as const;

const OTROS_BANCOS = [
  "cuscatlán", "cuscatlan", "bac", "davivienda", "promerica", "promérica",
  "hipotecario", "azul", "atlántida", "atlantida",
] as const;

const MAX_FRASES = 3;
const MAX_EXCLAMACIONES = 1;

export type MotivoRechazo =
  | "palabra_prohibida"
  | "otro_banco"
  | "demasiadas_frases"
  | "demasiadas_exclamaciones"
  | "monto_inventado"
  | "falta_presentacion"
  | "escalon_invalido"
  | "truncada"
  | "vacia";

export interface ResultadoValidacion {
  ok: boolean;
  motivo: MotivoRechazo | null;
  /** Texto para reinyectar al modelo en el reintento correctivo. */
  notaCorrectiva: string | null;
}

const OK: ResultadoValidacion = { ok: true, motivo: null, notaCorrectiva: null };

function rechazar(motivo: MotivoRechazo, notaCorrectiva: string): ResultadoValidacion {
  return { ok: false, motivo, notaCorrectiva };
}

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Cuenta frases sin dejarse engañar por los decimales ni saludos iniciales breves.
 *
 * Partir por `[.!?]` a secas hacía que "$145.00" contara como dos frases, y como el
 * mensaje de cierre siempre menciona el monto acordado, el cierre se rechazaba casi
 * siempre. Solo cuenta el signo si lo sigue un espacio o el final del texto.
 */
function contarFrases(texto: string): number {
  const sinSaludo = texto.replace(
    /^(?:¡?hola!?|¡?buenos d[íi]as!?|¡?buenas tardes!?|¡?buenas noches!?)(?:,?\s+[a-záéíóúñ]+)?[,\s!.]*/i,
    "",
  );
  const partes = sinSaludo.split(/[.!?]+(?=\s|$)/).filter((f) => f.trim().length > 0);
  return Math.max(1, partes.length);
}

/** Montos que el agente puede mencionar sin estar inventando. */
function montosPermitidos(
  cliente: Cliente,
  historial: readonly Turno[],
  senal?: SenalRiesgo | null,
): Set<string> {
  const permitidos = new Set<string>();
  const agregar = (n: number) => permitidos.add(n.toFixed(2));

  agregar(cliente.cuota);
  agregar(cliente.saldo);
  agregar(cliente.cuota / 2);
  // Con la misma señal que armó el contexto: si el riesgo desbloqueó una opción, sus
  // montos son legítimos. Validar contra una lista más corta rechazaría un cierre bueno.
  for (const opcion of opcionesValidasPara(cliente, senal)) {
    for (const m of opcion.detalle.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)) {
      agregar(Number(m[1].replace(/,/g, "")));
    }
  }
  // Lo que la propia persona dijo que tiene o puede pagar es un dato válido.
  for (const turno of historial) {
    if (turno.rol !== "cliente") continue;
    for (const m of turno.texto.matchAll(/\$?\s?([\d,]+(?:\.\d{1,2})?)/g)) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) agregar(n);
    }
  }
  return permitidos;
}

export interface ContextoValidacion {
  cliente: Cliente;
  historial: readonly Turno[];
  /** true cuando esta es la primera respuesta del agente en la conversación. */
  esPrimerMensajeDelAgente: boolean;
  /** La misma señal con la que se construyó el contexto del turno. */
  senal?: SenalRiesgo | null;
}

export function validar(respuesta: string, ctx: ContextoValidacion): ResultadoValidacion {
  const texto = respuesta.trim();
  if (texto.length === 0) {
    return rechazar("vacia", "La respuesta salió vacía. Respondé en 2 o 3 frases.");
  }

  const plano = normalizar(texto);

  for (const palabra of PALABRAS_PROHIBIDAS) {
    if (plano.includes(normalizar(palabra))) {
      return rechazar(
        "palabra_prohibida",
        `Usaste la palabra "${palabra}", que está prohibida. Reescribí sin jerga ni etiquetas: decí "tu pago", "tu cuota", "tu récord".`,
      );
    }
  }

  for (const banco of OTROS_BANCOS) {
    if (new RegExp(`\\b${normalizar(banco)}\\b`).test(plano)) {
      return rechazar(
        "otro_banco",
        "Mencionaste otro banco. No podés mencionar bancos distintos a Bancoagrícola.",
      );
    }
  }

  // Detección de meta-rechazos del modelo o disculpas genéricas de IA
  if (/\b(?:no puedo generar|no puedo proporcionar|no puedo cumplir|no estoy autorizado|no puedo continuar|no puedo seguir|como modelo de lenguaje|como inteligencia artificial|imite a un|no puedo imitar|fines de spam|spam o estafa)\b/i.test(texto)) {
    return rechazar(
      "palabra_prohibida",
      "No te niegues ni digas que no podés continuar. Respondé con amabilidad aclarando la duda de la persona.",
    );
  }

  // Detección de códigos internos de herramientas o respuestas no conversacionales
  if (/\[\d+\]/i.test(texto) || /^(?:opci[oó]n\s+\d+|escal[oó]n\s+\d+)\.?$/i.test(texto)) {
    return rechazar(
      "palabra_prohibida",
      "No uses corchetes ni códigos internos como '[2]'. Hablale directamente a la persona ofreciéndole la propuesta en una frase cálida y preguntale si le parece bien.",
    );
  }

  const frases = contarFrases(texto);
  if (frases > MAX_FRASES) {
    return rechazar(
      "demasiadas_frases",
      `Escribiste ${frases} frases y el máximo es ${MAX_FRASES}. Reescribí el MISMO mensaje en 3 frases o menos, sin perder el monto ni la fecha. Esto es una conversación, no un comunicado.`,
    );
  }

  if ((texto.match(/!/g) ?? []).length > MAX_EXCLAMACIONES) {
    return rechazar(
      "demasiadas_exclamaciones",
      "Demasiados signos de exclamación. Bajá el tono: cálido, no eufórico.",
    );
  }

  // Requisito de transparencia: el primer mensaje del agente siempre se presenta,
  // incluso cuando fue la persona la que escribió primero.
  if (ctx.esPrimerMensajeDelAgente) {
    const dicequienEs = /bancoagr[íi]cola/i.test(texto);
    const diceQueEsAsistente = /asistente|virtual|automat/i.test(texto);
    if (!dicequienEs || !diceQueEsAsistente) {
      return rechazar(
        "falta_presentacion",
        "Tu primer mensaje tiene que presentarte: que sos de Bancoagrícola y que sos un asistente. Eso no se omite nunca.",
      );
    }
  }

  const permitidos = montosPermitidos(ctx.cliente, ctx.historial, ctx.senal);
  for (const m of texto.matchAll(/\$\s?([\d,]+(?:\.\d{1,2})?)/g)) {
    const valor = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(valor)) continue;
    if (!permitidos.has(valor.toFixed(2))) {
      return rechazar(
        "monto_inventado",
        `Mencionaste $${valor.toFixed(2)}, que no sale del contexto. Usá solo los montos que te pasaron: la cuota, el saldo, o lo que la persona dijo.`,
      );
    }
  }

  return OK;
}

/** Respuesta segura cuando el reintento también falla. Nunca se muestra nada sin validar. */
export function respuestaSegura(cliente: Cliente, esPrimerMensajeDelAgente = false): string {
  if (esPrimerMensajeDelAgente) {
    return `Hola, te habla el asistente virtual de Bancoagrícola y la llamada queda grabada. ¿Hablo con ${cliente.nombre}?`;
  }
  return `${cliente.nombre}, soy el asistente de Bancoagrícola. Dejame confirmar esa opción con el área encargada y te escribo de nuevo. ¿Te parece si lo vemos con un asesor?`;
}

const PATRON_EMERGENCIA = /\b(?:suicid\w*|matar\w*|quitarme la vida|acabar con mi vida)\b/i;

/** Detecta emergencias humanas extremas o amenazas a la vida para transferir de inmediato sin LLM. */
export function esEmergenciaHumana(texto: string): boolean {
  return PATRON_EMERGENCIA.test(texto);
}

const REEMPLAZOS_VOSEO: Array<[RegExp, string]> = [
  [/\bquieres\b/g, "querés"],
  [/\bQuieres\b/g, "Querés"],
  [/\bpuedes\b/g, "podés"],
  [/\bPuedes\b/g, "Podés"],
  [/\btienes\b/g, "tenés"],
  [/\bTienes\b/g, "Tenés"],
  [/\bsabes\b/g, "sabés"],
  [/\bSabes\b/g, "Sabés"],
  [/\bdices\b/g, "decís"],
  [/\bDices\b/g, "Decís"],
  [/\bhaces\b/g, "hacés"],
  [/\bHaces\b/g, "Hacés"],
  [/\bentiendes\b/g, "entendés"],
  [/\bEntiendes\b/g, "Entendés"],
  [/\bpiensas\b/g, "pensás"],
  [/\bPiensas\b/g, "Pensás"],
  [/\bdime\b/g, "decime"],
  [/\bDime\b/g, "Decime"],
  [/\bcuéntame\b/g, "contame"],
  [/\bCuéntame\b/g, "Contame"],
  [/\bavísame\b/g, "avisame"],
  [/\bAvísame\b/g, "Avisame"],
  [/\bcontigo\b/g, "con vos"],
  [/\bContigo\b/g, "Con vos"],
  [/\bpara ti\b/g, "para vos"],
  [/\bPara ti\b/g, "Para vos"],
  [/\ba ti\b/g, "a vos"],
  [/\bA ti\b/g, "A vos"],
  [/\btú\b/g, "vos"],
  [/\bTú\b/g, "Vos"],
];

/** Normaliza tuteos accidentales al voseo salvadoreño natural. */
export function corregirVoseo(texto: string): string {
  let resultado = texto;
  for (const [patron, reemplazo] of REEMPLAZOS_VOSEO) {
    resultado = resultado.replace(patron, reemplazo);
  }
  return resultado;
}

/** Trunca un texto a un máximo de frases completas sin cortar palabras. */
export function truncarAFrases(texto: string, maxFrases: number = 3): string {
  const trimmed = texto.trim();
  if (trimmed.length === 0) return trimmed;
  const frases = trimmed.split(/(?<=[.!?]+)(?:\s+|$)/).filter((f) => f.trim().length > 0);
  if (frases.length <= maxFrases) return trimmed;
  return frases.slice(0, maxFrases).join(" ").trim();
}

/** Limpia preámbulos de IA como 'La respuesta al usuario es:', 'Agente:', JSON embebido, comillas envolventes, etc. */
export function limpiarPreambuloIa(texto: string): string {
  let t = texto.trim();

  // Si el LLM devolvió un bloque JSON simulando un mensaje o tool call
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("```json") && t.endsWith("```"))) {
    try {
      const cleanJson = t.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const obj = JSON.parse(cleanJson);
      if (typeof obj.parameters?.mensaje === "string") return obj.parameters.mensaje.trim();
      if (typeof obj.arguments?.mensaje === "string") return obj.arguments.mensaje.trim();
      if (typeof obj.parameters?.texto === "string") return obj.parameters.texto.trim();
      if (typeof obj.arguments?.texto === "string") return obj.arguments.texto.trim();
      if (typeof obj.mensaje === "string") return obj.mensaje.trim();
      if (typeof obj.texto === "string") return obj.texto.trim();
    } catch {
      // no era JSON parseable, continuar
    }
  }

  t = t.replace(/^(?:la respuesta (?:al usuario )?(?:es|ser[íi]a)|respuesta|agente)\s*:\s*/i, "");
  t = t.replace(/^["“](.*?)["”]?$/s, "$1").trim();
  return t;
}

