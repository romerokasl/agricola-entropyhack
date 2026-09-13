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
 */
export function diagnosticar(cliente: Cliente, hoy: Date = new Date()): Diagnostico {
  const diasHastaVencimiento = diasHastaDiaDelMes(cliente.diaPago, hoy);
  const base = {
    diasHastaVencimiento,
    diasHastaReporteBuro: diasHastaReporteBuro(hoy),
    proximoIngreso: proximoIngreso(cliente, hoy),
  };

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
  } else if (cliente.riesgoBanda === "CRITICAL" || cliente.riesgoBanda === "MODERATE_HIGH") {
    motivo = "riesgo_alto";
    detalle = `Sin atraso y con el calendario alineado, pero el scorer lo marca en banda ${cliente.riesgoBanda}.`;
  } else {
    detalle = "Nada que requiera contacto: sin atraso, calendario alineado y riesgo bajo.";
  }

  return { ...base, motivo, detalle };
}

export function debeContactar(cliente: Cliente, hoy: Date = new Date()): boolean {
  return diagnosticar(cliente, hoy).motivo !== null;
}
