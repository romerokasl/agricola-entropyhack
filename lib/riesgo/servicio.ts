import type { ClaseSSF, FactorRiesgo, FeaturesModelo } from "./types";

/**
 * Cliente del microservicio de inferencia (`ml/api.py`).
 *
 * Tres reglas de diseño, las tres por el demo en vivo:
 *
 * 1. **Nunca lanza.** Si Python no está levantado, devuelve `null` y el llamador sigue
 *    con las señales locales. El README promete que la app funciona sin el servicio.
 * 2. **Timeout corto y un solo intento.** Esto corre dentro del turno de una
 *    conversación; reintentar aquí sería sumar segundos a una respuesta que la persona
 *    está esperando. El scorer es un acompañante, no un bloqueante.
 * 3. **Se queda con los números y TIRA EL TEXTO.** El servicio devuelve
 *    `empatheticMessage` y `suggestedSolution` ya redactados, y esos textos violan los
 *    guardrails del banco: prometen "sin intereses moratorios", inventan una
 *    "readecuación personalizada con menor cuota" y saltan directo al escalón más caro
 *    de la escalera. Quien redacta es el agente, con las opciones que calcula
 *    `lib/agent/ladder.ts`. El modelo aporta la señal, nunca las palabras.
 */

const TIMEOUT_MS = 1500;

interface RespuestaPredict {
  success?: boolean;
  data?: {
    riskScore?: number;
    riskLevel?: string;
    predictedArrearsClass?: string;
    defaultProbability?: number;
    topRiskFactors?: Array<{ factor?: string; impact?: string }>;
  };
  meta?: { latencyMs?: number; modelType?: string; usedRealModel?: boolean };
}

export interface SalidaModelo {
  score: number;
  claseSSF: ClaseSSF | null;
  probabilidad: number | null;
  factores: readonly FactorRiesgo[];
  modeloVersion: string;
  /** false cuando el servicio respondió pero cayó a su propia heurística interna. */
  usoModeloReal: boolean;
}

const CLASES_SSF: readonly string[] = ["Healthy", "A1", "A2", "B", "C", "D_E"];

function aClaseSSF(valor: string | undefined): ClaseSSF | null {
  return valor !== undefined && CLASES_SSF.includes(valor) ? (valor as ClaseSSF) : null;
}

export function urlServicioMl(): string {
  return (process.env.ML_SERVICE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

export async function consultarModelo(features: FeaturesModelo): Promise<SalidaModelo | null> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${urlServicioMl()}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
      signal: controlador.signal,
      cache: "no-store",
    });

    if (!res.ok) return null;

    const json = (await res.json()) as RespuestaPredict;
    const datos = json.data;
    if (!datos || typeof datos.riskScore !== "number") return null;

    // Solo se leen estos campos. `empatheticMessage` y `suggestedSolution` existen en
    // la respuesta y se descartan a propósito — ver el encabezado del archivo.
    const factores: FactorRiesgo[] = (datos.topRiskFactors ?? [])
      .filter((f) => typeof f.factor === "string" && f.factor.length > 0)
      .map((f) => ({
        origen: "modelo" as const,
        factor: f.impact ? `${f.factor} (${f.impact})` : (f.factor as string),
      }));

    return {
      score: Math.max(0, Math.min(100, Math.round(datos.riskScore))),
      claseSSF: aClaseSSF(datos.predictedArrearsClass),
      probabilidad: typeof datos.defaultProbability === "number" ? datos.defaultProbability : null,
      factores,
      modeloVersion: json.meta?.modelType ?? "desconocido",
      usoModeloReal: json.meta?.usedRealModel === true,
    };
  } catch {
    // Servicio caído, DNS, timeout: el flujo sigue con las señales locales.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Espejo en TypeScript de la heurística de respaldo de `ml/api.py`.
 *
 * Mismos pesos y mismo orden de operaciones, para que un cliente puntuado sin el
 * servicio caiga en la misma banda que con él. Se usa solo cuando el servicio no
 * responde Y el cliente tampoco trae un score de lote en su fila.
 */
export function puntuarLocalmente(features: FeaturesModelo): number {
  const prob =
    features.creditLineUtilization * 0.35 +
    (features.debtToIncomeRatio / 1.5) * 0.3 +
    Math.max(0, features.savingsDropPct) * 0.2 +
    Math.min(features.latePaymentsLast6m * 0.15, 0.4);

  return Math.round(Math.max(0.05, Math.min(0.95, prob)) * 100);
}
