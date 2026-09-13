/**
 * Clasificación y reservas de NCB-022 para créditos de consumo.
 *
 * Fuente: docs/contexto/05-productos-y-ncb022.md, Parte 2 (Anexo 1 numeral 9 para los
 * días, Art. 18 para el % de reserva). Solo la tabla de consumo: vivienda y empresa se
 * clasifican distinto y ningún cliente sembrado los tiene.
 */

export type CategoriaConsumo = "A1" | "A2" | "B" | "C1" | "C2" | "D1" | "D2" | "E";

const TABLA: ReadonlyArray<{ categoria: CategoriaConsumo; hastaDias: number; reserva: number }> = [
  { categoria: "A1", hastaDias: 7, reserva: 0 },
  { categoria: "A2", hastaDias: 30, reserva: 0.01 },
  { categoria: "B", hastaDias: 60, reserva: 0.05 },
  { categoria: "C1", hastaDias: 90, reserva: 0.15 },
  { categoria: "C2", hastaDias: 120, reserva: 0.25 },
  { categoria: "D1", hastaDias: 150, reserva: 0.5 },
  { categoria: "D2", hastaDias: 180, reserva: 0.75 },
  { categoria: "E", hastaDias: Number.POSITIVE_INFINITY, reserva: 1 },
];

/** Cuántos días de mora suma una cuota que no se paga en el ciclo. */
export const DIAS_CICLO_SIN_INTERVENCION = 30;

export const SUPUESTO_PROVISIONES =
  "Escenario conservador: sin intervención, la cuota queda impaga un ciclo más " +
  `(+${DIAS_CICLO_SIN_INTERVENCION} días de mora); con el acuerdo, el crédito conserva su ` +
  "categoría actual. Tabla de consumo NCB-022 sobre el saldo completo, porque los " +
  "productos sembrados no tienen garantía real. Cada cliente cuenta una vez.";

function fila(diasMora: number) {
  const dias = Math.max(0, diasMora);
  // La última fila llega a infinito, así que siempre hay coincidencia.
  return TABLA.find((f) => dias <= f.hastaDias) ?? TABLA[TABLA.length - 1];
}

export function categoriaConsumo(diasMora: number): CategoriaConsumo {
  return fila(diasMora).categoria;
}

export function porcentajeReserva(diasMora: number): number {
  return fila(diasMora).reserva;
}

/** saldo × (%reserva sin intervención − %reserva con intervención). */
export function reservaEvitadaUsd(saldo: number, diasAtraso: number): number {
  const sin = porcentajeReserva(diasAtraso + DIAS_CICLO_SIN_INTERVENCION);
  const con = porcentajeReserva(diasAtraso);
  return saldo * (sin - con);
}
