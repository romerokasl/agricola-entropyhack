import { fechaSugeridaAlineada, hayDesalineacionQuincena, hayDesalineacionRemesa } from "./calendario";
import type { Cliente } from "./types";

/**
 * La escalera de opciones y los límites de negociación.
 *
 * Esto es deliberadamente código y no prompt: el modelo decide CÓMO lo dice, el código
 * decide QUÉ se puede ofrecer. Fuente autoritativa:
 * docs/contexto/01-reglas-del-agente.md §2 y §3.
 *
 * Los escalones 6 y 7 usan productos que Bancoagrícola ya tiene. Nada inventado — es
 * el guardrail "si no está en la lista, no existe".
 */

export type IdEscalon =
  | "recordatorio"
  | "mover_fecha"
  | "abono_parcial"
  | "debito_automatico"
  | "dividir_cuota"
  | "adelanto_salario"
  | "reestructura"
  | "pase_humano";

export interface Escalon {
  readonly escalon: number;
  readonly id: IdEscalon;
  readonly titulo: string;
  readonly cuando: string;
  readonly costoBanco: "ninguno" | "bajo" | "medio" | "alto";
}

export const ESCALERA: readonly Escalon[] = [
  { escalon: 1, id: "recordatorio",      titulo: "Recordatorio o confirmación de pago",   cuando: "Fue olvido y va a pagar",                   costoBanco: "ninguno" },
  { escalon: 2, id: "mover_fecha",       titulo: "Mover la fecha de pago a la quincena",  cuando: "Hay desalineación estructural de calendario", costoBanco: "ninguno" },
  { escalon: 3, id: "abono_parcial",     titulo: "Abono parcial que evita la mora",       cuando: "Le falta poco para completar la cuota",      costoBanco: "ninguno" },
  { escalon: 4, id: "debito_automatico", titulo: "Activar débito automático",             cuando: "El olvido es recurrente",                    costoBanco: "ninguno" },
  { escalon: 5, id: "dividir_cuota",     titulo: "Dividir la cuota en dos pagos quincenales", cuando: "Estrés de liquidez temporal",            costoBanco: "bajo" },
  { escalon: 6, id: "adelanto_salario",  titulo: "Adelanto de Salario o Extrafinanciamiento", cuando: "Necesita liquidez puntual",              costoBanco: "medio" },
  { escalon: 7, id: "reestructura",      titulo: "Reestructura o readecuación",           cuando: "Estrés sostenido, no puntual",               costoBanco: "alto" },
  { escalon: 8, id: "pase_humano",       titulo: "Pase a asesor humano",                  cuando: "Situación delicada, o la persona lo pide",   costoBanco: "alto" },
] as const;

/** Límites duros que dio el banco. Los créditos se pagan en 30 días. */
export const LIMITES = {
  /** Se puede acordar el vencimiento, o hasta 3 días después. */
  diasGraciaMaximos: 3,
  /** Mover la fecha de corte al siguiente ciclo sí se puede; más allá, no. */
  diasMaximosConAjusteDeFecha: 30,
  condonarCapital: false,
  condonarIntereses: false,
  /** Un abono parcial tiene que tener monto y fecha. "Pagá lo que podás" no es acuerdo. */
  abonoParcialMinimoRatio: 0.3,
} as const;

export interface OpcionValida extends Escalon {
  /** Parámetros concretos ya calculados, para que el modelo no los invente. */
  readonly detalle: string;
}

/**
 * Qué se le puede ofrecer a ESTE cliente, calculado en código.
 *
 * El modelo nunca decide si una opción aplica: recibe esta lista y elige, dentro de
 * ella, el escalón más bajo que resuelva el caso.
 */
export function opcionesValidasPara(cliente: Cliente): readonly OpcionValida[] {
  const validas: OpcionValida[] = [];
  const porId = (id: IdEscalon): Escalon => {
    const e = ESCALERA.find((x) => x.id === id);
    if (!e) throw new Error(`Escalón inexistente: ${id}`);
    return e;
  };
  const agregar = (id: IdEscalon, detalle: string) => validas.push({ ...porId(id), detalle });

  agregar("recordatorio", `Cuota de $${cliente.cuota.toFixed(2)} con vencimiento el día ${cliente.diaPago}.`);

  const nuevaFecha = fechaSugeridaAlineada(cliente);
  if (nuevaFecha !== null) {
    const razon = hayDesalineacionQuincena(cliente)
      ? `cobra el ${cliente.diaIngreso1} y el ${cliente.diaIngreso2}`
      : `su remesa entra el ${cliente.diaRemesa}`;
    agregar("mover_fecha", `Mover el vencimiento del día ${cliente.diaPago} al ${nuevaFecha}, porque ${razon}. Sin costo.`);
  }

  const minimo = cliente.cuota * LIMITES.abonoParcialMinimoRatio;
  agregar("abono_parcial", `Abono parcial de al menos $${minimo.toFixed(2)} de los $${cliente.cuota.toFixed(2)}, para evitar el deterioro.`);

  if (!cliente.tieneDebitoAutomatico) {
    agregar("debito_automatico", "Activar el cargo automático a cuenta, sin costo.");
  }

  if (cliente.tipoIngreso === "quincenal") {
    const mitad = cliente.cuota / 2;
    agregar("dividir_cuota", `Dos pagos de $${mitad.toFixed(2)}, el ${cliente.diaIngreso1} y el ${cliente.diaIngreso2}.`);
  }

  const aplicaAdelanto = cliente.segmento === "Asalariado" || cliente.producto.includes("Tarjeta");
  if (aplicaAdelanto) {
    agregar("adelanto_salario", "Adelanto de Salario o Extrafinanciamiento: productos que el banco ya ofrece.");
  }

  // Escalón caro: solo ante estrés sostenido, nunca como primera oferta. Es el error
  // que comete el adviceMap de /api/predict, que salta aquí directo.
  if (cliente.diasAtraso > 15 || cliente.riesgoBanda === "CRITICAL") {
    agregar("reestructura", "Readecuación del crédito, por estrés sostenido.");
  }

  agregar("pase_humano", "Pasar con un asesor humano.");

  return validas;
}

export function esEscalonValidoPara(cliente: Cliente, id: string): boolean {
  return opcionesValidasPara(cliente).some((o) => o.id === id);
}

/** Un plazo es válido si cae en el vencimiento o hasta 3 días después. */
export function esPlazoValido(diasDesdeVencimiento: number): boolean {
  return diasDesdeVencimiento >= 0 && diasDesdeVencimiento <= LIMITES.diasGraciaMaximos;
}
