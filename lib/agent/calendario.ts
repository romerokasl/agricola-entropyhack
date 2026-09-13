import type { SenalRiesgo } from "../riesgo/types";
import type { Cliente, Diagnostico, MotivoContacto } from "./types";

/**
 * Lógica de calendario salvadoreño. Es el diferenciador del agente: la mayoría de la
 * gente cobra el 15 y el 30, y los burós consolidan los primeros 10 días del mes.
 * Ninguna de las dos cosas la sabe un buró de crédito.
 */

/** Ventana legal: los burós actualizan registros los primeros 10 días de cada mes. */
const DIA_CORTE_BURO = 10;

/** Una cuota que vence en esta franja cae antes de que entre la quincena del 15. */
const FRANJA_DESALINEADA = { desde: 5, hasta: 12 } as const;

function diasEnMes(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
}

/** Días desde hoy hasta el día `dia` del mes, saltando al mes siguiente si ya pasó. */
function diasHastaDiaDelMes(dia: number, hoy: Date): number {
  const diaHoy = hoy.getDate();
  if (dia >= diaHoy) return dia - diaHoy;
  return diasEnMes(hoy) - diaHoy + dia;
}

/** Días desde hoy hasta el vencimiento de la cuota. 0 = vence hoy. */
export function diasHastaVencimiento(cliente: Cliente, hoy: Date = new Date()): number {
  return diasHastaDiaDelMes(cliente.diaPago, hoy);
}

export function hayDesalineacionQuincena(cliente: Cliente): boolean {
  return (
    cliente.tipoIngreso === "quincenal" &&
    cliente.diaPago >= FRANJA_DESALINEADA.desde &&
    cliente.diaPago <= FRANJA_DESALINEADA.hasta
  );
}

export function hayDesalineacionRemesa(cliente: Cliente): boolean {
  return cliente.diaRemesa !== null && cliente.diaRemesa > cliente.diaPago;
}

/**
 * La fecha que resuelve la desalineación: el primer día de cobro que cae después del
 * vencimiento actual. Para un quincenal con cuota el 8, es el 16.
 */
export function fechaSugeridaAlineada(cliente: Cliente): number | null {
  if (hayDesalineacionRemesa(cliente) && cliente.diaRemesa !== null) {
    return Math.min(cliente.diaRemesa + 1, 28);
  }
  if (!hayDesalineacionQuincena(cliente)) return null;
  return cliente.diaIngreso1 + 1;
}

export function proximoIngreso(cliente: Cliente, hoy: Date): number | null {
  const dias = [cliente.diaIngreso1, cliente.diaIngreso2, cliente.diaRemesa].filter(
    (d): d is number => d !== null,
  );
  if (dias.length === 0) return null;
  return dias.reduce((mejor, dia) =>
    diasHastaDiaDelMes(dia, hoy) < diasHastaDiaDelMes(mejor, hoy) ? dia : mejor,
  );
}

export function diasHastaReporteBuro(hoy: Date): number {
  return diasHastaDiaDelMes(DIA_CORTE_BURO, hoy);
}

/**
 * Decide si el sistema abre una conversación y por qué.
 *
 * Esto es lo que hace que el caso de control funcione: Marta no se excluye con un
 * flag en la base de datos, se excluye porque sus datos no disparan ningún motivo.
 *
 * `senal` es la salida viva del scorer (`lib/riesgo`). Cuando viene, manda sobre la
 * columna `riesgo_banda` del cliente, que es el score de lote y puede estar viejo.
 * El orden de los motivos NO cambia: atraso y desalineación se evalúan antes que el
 * riesgo, así que una señal baja nunca puede apagar un contacto que los datos duros
 * ya justificaban.
 */
export function diagnosticar(
  cliente: Cliente,
  hoy: Date = new Date(),
  senal?: SenalRiesgo | null,
): Diagnostico {
  const base = {
    diasHastaVencimiento: diasHastaVencimiento(cliente, hoy),
    diasHastaReporteBuro: diasHastaReporteBuro(hoy),
    proximoIngreso: proximoIngreso(cliente, hoy),
  };

  const banda = senal?.banda ?? cliente.riesgoBanda;
  let motivo: MotivoContacto | null = null;
  let detalle = "";

  if (cliente.diasAtraso > 0) {
    motivo = "atraso";
    detalle = `Lleva ${cliente.diasAtraso} día(s) desde el vencimiento. Faltan ${base.diasHastaReporteBuro} día(s) para que se consolide en el buró.`;
  } else if (hayDesalineacionQuincena(cliente)) {
    motivo = "desalineacion_quincena";
    detalle = `Cobra el ${cliente.diaIngreso1} y el ${cliente.diaIngreso2}, pero la cuota vence el ${cliente.diaPago}: vence antes de que le entre la quincena.`;
  } else if (hayDesalineacionRemesa(cliente)) {
    motivo = "desalineacion_remesa";
    detalle = `Su remesa entra el ${cliente.diaRemesa} y la cuota vence el ${cliente.diaPago}: son ${cliente.diaRemesa! - cliente.diaPago} día(s) de diferencia, todos los meses.`;
  } else if (banda === "CRITICAL" || banda === "MODERATE_HIGH") {
    motivo = "riesgo_alto";
    // Ojo: este texto entra al prompt dentro de "por qué se abre esta conversación".
    // No puede nombrar la banda ni al scorer — el modelo lo repetiría, y "score" es
    // justo una de las palabras que el banco prohibió. Además, acá NO hay un hecho
    // concreto que contarle a la persona: decirle que un sistema la marcó sería
    // inventar una razón. La instrucción correcta es preguntar antes de proponer.
    detalle =
      "No hay atraso ni desfase de fechas: es un acercamiento preventivo. No hay un " +
      "hecho concreto que nombrar, así que no inventés uno: preguntá cómo viene su mes " +
      "antes de proponer nada.";
  } else {
    detalle = "Nada que requiera contacto: sin atraso, calendario alineado y riesgo bajo.";
  }

  return { ...base, motivo, detalle };
}

export function debeContactar(
  cliente: Cliente,
  hoy: Date = new Date(),
  senal?: SenalRiesgo | null,
): boolean {
  return diagnosticar(cliente, hoy, senal).motivo !== null;
}
