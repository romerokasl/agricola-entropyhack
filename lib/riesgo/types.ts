import type { BandaRiesgo } from "../agent/types";

/**
 * Contratos de la señal de riesgo. Este archivo NO importa nada que ejecute código:
 * así `lib/agent/*` puede tipar contra la señal sin crear un ciclo de importación.
 */

/**
 * Clases de días de atraso de la NCB-022, tal como las predice el modelo de `ml/`.
 * Es vocabulario regulatorio: vive en la consola interna, nunca en la conversación.
 */
export type ClaseSSF = "Healthy" | "A1" | "A2" | "B" | "C" | "D_E";

/** De dónde salió un factor concreto. */
export type Origen = "modelo" | "reglas";

/**
 * Cuál de las tres vistas produjo el score final de la señal.
 * Es trazabilidad, no preferencia: la señal es el máximo de las tres.
 */
export type FuenteSenal = "modelo_vivo" | "score_registrado" | "reglas";

export interface FactorRiesgo {
  /** Descripción en lenguaje llano. Interna: nunca se le muestra a la persona. */
  factor: string;
  origen: Origen;
}

/**
 * Lo que se le manda al modelo. Los nombres son los que declara `ml/api.py`
 * (`PredictionInput`) — si cambian allá, este es el único archivo que se toca acá.
 */
export interface FeaturesModelo {
  customerId: string;
  creditLineUtilization: number;
  debtToIncomeRatio: number;
  savingsDropPct: number;
  latePaymentsLast6m: number;
  daysUntilNextPayment: number;
  recentPaymentDifference: number;
}

/** Qué se derivó de datos reales del cliente y qué se mandó con un valor neutro. */
export interface TrazaFeatures {
  features: FeaturesModelo;
  /**
   * Features que el esquema de `clientes` NO permite observar hoy. Se mandan con
   * valor neutro y se declaran acá para no presentarlas como medidas.
   */
  noObservadas: readonly string[];
}

/**
 * La señal que alimenta una conversación, sin importar el canal.
 *
 * Es lo único que cruza desde `ml/` hacia el agente: números y factores.
 * **El texto que sugiere el servicio (`empatheticMessage`, `suggestedSolution`) se
 * descarta acá a propósito** — ver `lib/riesgo/servicio.ts`.
 */
export interface SenalRiesgo {
  /** 0-100. Combinación del componente del modelo y el de reglas locales. */
  score: number;
  banda: BandaRiesgo;
  /** Clase NCB-022 predicha. `null` cuando el modelo no respondió. */
  claseSSF: ClaseSSF | null;
  probabilidadIncumplimiento: number | null;
  fuente: FuenteSenal;
  /** El microservicio de `ml/`, si respondió a tiempo. */
  componenteModeloVivo: number | null;
  /** `clientes.riesgo_score`: la corrida de lote del scorer. */
  componenteRegistro: number | null;
  /** Calendario salvadoreño y comportamiento observable. Siempre disponible. */
  componenteReglas: number;
  factores: readonly FactorRiesgo[];
  /** Escalón mínimo de la escalera por el que el sistema sugiere empezar (1-8). */
  escalonSugerido: number;
  latenciaMs: number;
  modeloVersion: string | null;
  noObservadas: readonly string[];
}

/** Forma con la que la señal viaja a Postgres y vuelve. */
export interface SenalPersistida {
  score: number;
  banda: BandaRiesgo;
  claseSSF: ClaseSSF | null;
  fuente: FuenteSenal;
  /** El microservicio de `ml/`, si respondió a tiempo. */
  componenteModeloVivo: number | null;
  /** `clientes.riesgo_score`: la corrida de lote del scorer. */
  componenteRegistro: number | null;
  /** Calendario salvadoreño y comportamiento observable. Siempre disponible. */
  componenteReglas: number;
  escalonSugerido: number;
  factores: readonly FactorRiesgo[];
}
