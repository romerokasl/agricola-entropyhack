import { hayDesalineacionQuincena, hayDesalineacionRemesa } from "../agent/calendario";
import type { Cliente } from "../agent/types";
import { derivarFeatures } from "./features";
import { bandaDesdeScore, puntuarReglas } from "./reglas";
import { consultarModelo, puntuarLocalmente } from "./servicio";
import type { FuenteSenal, SenalPersistida, SenalRiesgo } from "./types";

export { bandaDesdeScore } from "./reglas";
export { urlServicioMl } from "./servicio";
export type * from "./types";

/**
 * Dónde se junta todo: el modelo de `ml/` y las señales locales de calendario.
 *
 * ## Por qué se combinan y no se elige uno
 *
 * El modelo se entrenó con Home Credit. Ve apalancamiento y comportamiento de pago,
 * pero no puede ver que alguien cobra el 15 y el 30 y que su cuota vence el 8 — esa
 * columna no existe en ese dataset y tampoco en un buró. Las reglas locales ven
 * exactamente eso y nada del apalancamiento. Son dos vistas complementarias, no dos
 * intentos de medir lo mismo.
 *
 * ## Son TRES vistas, no dos
 *
 * 1. **Modelo vivo** — el microservicio de `ml/`, llamado en el momento.
 * 2. **Score de lote** — `clientes.riesgo_score`, la corrida previa del scorer.
 * 3. **Reglas locales** — calendario salvadoreño y comportamiento observable.
 *
 * La segunda no es redundante con la primera. La llamada en vivo solo puede mandar lo
 * que hay en la fila del cliente (ver `features.ts`: sin ingreso, sin serie de ahorro,
 * sin historial de pagos). El proceso de lote corre sobre el historial completo, así
 * que ve cosas que la llamada en vivo no puede ver: estacionalidad de un negocio,
 * la tendencia de alguien que sube su extrafinanciamiento cuatro meses seguidos,
 * liquidez apretada. **Descartarla porque respondió una vista más delgada sería tirar
 * información.** Medido acá: hacerlo sacaba a tres de los ocho casos del pitch del
 * conjunto de contacto.
 *
 * ## Por qué el máximo y no el promedio
 *
 * Esto es un sistema de **alerta temprana**: que una sola de las vistas se encienda ya
 * justifica una conversación. Promediarlas las diluye — alguien con calendario
 * impecable y estrés financiero alto quedaría en banda media y nadie lo contactaría.
 * Las tres se guardan por separado, así que la consola interna siempre puede decir
 * cuál de ellas abrió la conversación.
 *
 * El control se mantiene: Marta puntúa bajo en las tres, así que sigue sin ser
 * contactada. Eso se deriva de sus datos, no de un flag.
 */

/** Escalones de `lib/agent/ladder.ts` por los que el sistema sugiere empezar. */
const ESCALON_RECORDATORIO = 1;
const ESCALON_MOVER_FECHA = 2;
const ESCALON_DIVIDIR_CUOTA = 5;

/**
 * El escalón MÍNIMO por el que conviene empezar. Es un piso, no un techo: si la
 * persona cuenta algo que amerita más, el agente sube durante la conversación.
 * Nunca apunta a un escalón caro "por si acaso" — eso es justo el error que comete
 * el texto sugerido del servicio de ML.
 */
function sugerirEscalon(cliente: Cliente, banda: string): number {
  if (hayDesalineacionQuincena(cliente) || hayDesalineacionRemesa(cliente)) {
    return ESCALON_MOVER_FECHA;
  }
  if (banda === "CRITICAL") return ESCALON_DIVIDIR_CUOTA;
  return ESCALON_RECORDATORIO;
}

/**
 * La señal completa. **Nunca lanza**: si el servicio de ML no responde, cae al score
 * de lote de la fila del cliente y, si tampoco lo hay, a la heurística local.
 */
export async function obtenerSenalRiesgo(
  cliente: Cliente,
  hoy: Date = new Date(),
): Promise<SenalRiesgo> {
  const inicio = Date.now();

  const { features, noObservadas } = derivarFeatures(cliente, hoy);
  const reglas = puntuarReglas(cliente);
  const salida = await consultarModelo(features);

  // Si ni el servicio respondió ni la fila trae score de lote, el espejo local de la
  // heurística del servicio mantiene una vista de modelo en pie. Así el demo nunca se
  // queda con una sola vista.
  const componenteModeloVivo = salida?.score ?? null;
  const componenteRegistro = cliente.riesgoScore;
  const componenteReglas = reglas.score;
  const respaldo =
    componenteModeloVivo === null && componenteRegistro === null
      ? puntuarLocalmente(features)
      : null;

  const { score, fuente } = mayor([
    { valor: componenteModeloVivo, fuente: "modelo_vivo" as const },
    { valor: componenteRegistro, fuente: "score_registrado" as const },
    { valor: respaldo, fuente: "reglas" as const },
    { valor: componenteReglas, fuente: "reglas" as const },
  ]);

  const banda = bandaDesdeScore(score);

  return {
    score,
    banda,
    claseSSF: salida?.claseSSF ?? null,
    probabilidadIncumplimiento: salida?.probabilidad ?? null,
    fuente,
    componenteModeloVivo,
    componenteRegistro,
    componenteReglas,
    factores: [...reglas.factores, ...(salida?.factores ?? [])],
    escalonSugerido: sugerirEscalon(cliente, banda),
    latenciaMs: Date.now() - inicio,
    modeloVersion:
      salida === null
        ? null
        : salida.usoModeloReal
          ? salida.modeloVersion
          : `${salida.modeloVersion} (heurística del servicio)`,
    noObservadas,
  };
}

/** El máximo de las vistas disponibles, y cuál de ellas lo produjo. */
function mayor(
  vistas: ReadonlyArray<{ valor: number | null; fuente: FuenteSenal }>,
): { score: number; fuente: FuenteSenal } {
  let score = 0;
  let fuente: FuenteSenal = "reglas";
  for (const vista of vistas) {
    if (vista.valor !== null && vista.valor > score) {
      score = vista.valor;
      fuente = vista.fuente;
    }
  }
  return { score, fuente };
}

/**
 * La misma señal sin tocar la red. La usan la verificación de reglas y cualquier
 * camino que no pueda permitirse una llamada HTTP.
 */
export function senalSinRed(cliente: Cliente, hoy: Date = new Date()): SenalRiesgo {
  const { features, noObservadas } = derivarFeatures(cliente, hoy);
  const reglas = puntuarReglas(cliente);
  const respaldo = cliente.riesgoScore === null ? puntuarLocalmente(features) : null;

  const { score, fuente } = mayor([
    { valor: cliente.riesgoScore, fuente: "score_registrado" },
    { valor: respaldo, fuente: "reglas" },
    { valor: reglas.score, fuente: "reglas" },
  ]);
  const banda = bandaDesdeScore(score);

  return {
    score,
    banda,
    claseSSF: null,
    probabilidadIncumplimiento: null,
    fuente,
    componenteModeloVivo: null,
    componenteRegistro: cliente.riesgoScore,
    componenteReglas: reglas.score,
    factores: reglas.factores,
    escalonSugerido: sugerirEscalon(cliente, banda),
    latenciaMs: 0,
    modeloVersion: null,
    noObservadas,
  };
}

/**
 * Reconstruye la señal desde lo que quedó guardado con la conversación.
 *
 * Los turnos 2 en adelante NO vuelven a llamar al scorer: usan la misma señal con la
 * que se abrió. Así la conversación entera se explica con una sola señal auditable, y
 * no se le suman 1.5 s de red a cada respuesta que la persona está esperando.
 */
export function rehidratarSenal(persistida: SenalPersistida): SenalRiesgo {
  return {
    ...persistida,
    probabilidadIncumplimiento: null,
    latenciaMs: 0,
    modeloVersion: null,
    noObservadas: [],
  };
}
