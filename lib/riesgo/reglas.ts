import { hayDesalineacionQuincena, hayDesalineacionRemesa } from "../agent/calendario";
import type { BandaRiesgo, Cliente } from "../agent/types";
import type { FactorRiesgo } from "./types";

/**
 * El componente LOCAL de la señal: lo que el modelo no puede saber.
 *
 * El modelo de `ml/` se entrenó con Home Credit — un dataset europeo de solicitudes de
 * crédito. Ahí no existe la quincena salvadoreña, ni el día en que entra una remesa, ni
 * el hecho de que el débito automático haga irrelevante el olvido. Esas señales son
 * justo nuestra ventaja (`CLAUDE.md`, insights 1 y 2), así que se calculan en código y
 * se combinan con la salida del modelo en vez de pedírselas a él.
 *
 * **Los pesos son los mismos que usa `scripts/dataset.mjs` (`derivarRiesgo`)**, sin el
 * jitter aleatorio. No es casualidad: si el seed puntuara con una fórmula y el agente
 * con otra, el dashboard contradiría a la conversación en vivo.
 */

const BASE = 18;
const PESO_DESALINEACION_QUINCENA = 40;
const PESO_DESALINEACION_REMESA = 38;
const PESO_INGRESO_IRREGULAR = 12;
const PESO_POR_DIA_DE_ATRASO = 3;
const TOPE_ATRASO = 36;
const DESCUENTO_DEBITO_AUTOMATICO = 14;

/** Cortes de banda. Idénticos a los de `dataset.mjs` y a los de `ml/api.py`. */
const CORTE_CRITICAL = 75;
const CORTE_MODERATE_HIGH = 55;
const CORTE_MODERATE = 30;

export function bandaDesdeScore(score: number): BandaRiesgo {
  if (score >= CORTE_CRITICAL) return "CRITICAL";
  if (score >= CORTE_MODERATE_HIGH) return "MODERATE_HIGH";
  if (score >= CORTE_MODERATE) return "MODERATE";
  return "LOW";
}

export interface ComponenteReglas {
  score: number;
  factores: readonly FactorRiesgo[];
}

/**
 * Puntúa las señales locales de un cliente. Determinista y sin red: es la que sostiene
 * el demo cuando el servicio de Python no está levantado.
 */
export function puntuarReglas(cliente: Cliente): ComponenteReglas {
  const factores: FactorRiesgo[] = [];
  let score = BASE;

  if (hayDesalineacionQuincena(cliente)) {
    score += PESO_DESALINEACION_QUINCENA;
    factores.push({
      origen: "reglas",
      factor: `La cuota vence el ${cliente.diaPago} y cobra el ${cliente.diaIngreso1} y el ${cliente.diaIngreso2}: vence antes de que le entre la quincena`,
    });
  }

  if (hayDesalineacionRemesa(cliente) && cliente.diaRemesa !== null) {
    score += PESO_DESALINEACION_REMESA;
    factores.push({
      origen: "reglas",
      factor: `Su remesa entra el ${cliente.diaRemesa} y la cuota vence el ${cliente.diaPago}: ${cliente.diaRemesa - cliente.diaPago} día(s) de desfase, todos los meses`,
    });
  }

  if (cliente.tipoIngreso === "irregular") {
    score += PESO_INGRESO_IRREGULAR;
    factores.push({ origen: "reglas", factor: "Sus ingresos no entran en una fecha fija" });
  }

  if (cliente.diasAtraso > 0) {
    score += Math.min(cliente.diasAtraso * PESO_POR_DIA_DE_ATRASO, TOPE_ATRASO);
    factores.push({
      origen: "reglas",
      factor: `Lleva ${cliente.diasAtraso} día(s) desde el vencimiento`,
    });
  }

  if (cliente.tieneDebitoAutomatico) {
    score -= DESCUENTO_DEBITO_AUTOMATICO;
    factores.push({ origen: "reglas", factor: "Ya tiene el cargo automático activo" });
  }

  return { score: Math.max(2, Math.min(97, Math.round(score))), factores };
}
