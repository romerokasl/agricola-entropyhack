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

function contarFrases(texto: string): number {
  return texto.split(/[.!?]+/).filter((f) => f.trim().length > 0).length;
}

/** Montos que el agente puede mencionar sin estar inventando. */
function montosPermitidos(cliente: Cliente, historial: readonly Turno[]): Set<string> {
  const permitidos = new Set<string>();
  const agregar = (n: number) => permitidos.add(n.toFixed(2));

  agregar(cliente.cuota);
  agregar(cliente.saldo);
  agregar(cliente.cuota / 2);
  for (const opcion of opcionesValidasPara(cliente)) {
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

  if (contarFrases(texto) > MAX_FRASES) {
    return rechazar(
      "demasiadas_frases",
      `Te pasaste de ${MAX_FRASES} frases. Esto es una conversación, no un comunicado: decilo en 2 o 3.`,
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

  const permitidos = montosPermitidos(ctx.cliente, ctx.historial);
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
export function respuestaSegura(cliente: Cliente): string {
  return `${cliente.nombre}, soy el asistente de Bancoagrícola. Dejame confirmar esa opción con el área encargada y te escribo de nuevo. ¿Te parece si lo vemos con un asesor?`;
}
