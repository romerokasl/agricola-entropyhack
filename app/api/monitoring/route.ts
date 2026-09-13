import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Route Handler para Observabilidad MLOps de Banco Agrícola:
 * - GET: Retorna telemetría, percentiles de latencia, salud de predicción y reporte de Data Drift.
 * - POST: Permite simular escenarios de estrés macroeconómico para validar el detector de Drift en vivo.
 */
export async function GET() {
  const mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const [metricsRes, driftRes] = await Promise.all([
      fetch(`${mlServiceUrl}/metrics`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null),
      fetch(`${mlServiceUrl}/drift`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null),
    ]);
    clearTimeout(timeoutId);

    const metricsData = metricsRes?.ok ? await metricsRes.json() : null;
    const driftData = driftRes?.ok ? await driftRes.json() : null;

    if (!metricsData && !driftData) {
      return NextResponse.json(
        {
          success: true,
          status: "fallback_simulation",
          message: "Microservicio FastAPI no disponible en local. Mostrando telemetría base simulada.",
          data: {
            telemetry: {
              uptime_seconds: 3600,
              total_requests: 120,
              requests_per_minute: 24.5,
              error_rate_pct: 0.0,
              model_usage_pct: 100.0,
              latency_ms: { p50: 12.4, p95: 18.2, p99: 24.1, mean: 13.5 },
            },
            data_drift: {
              status: "HEALTHY",
              highest_psi: 0.045,
              drifted_features_count: 0,
              recommendation: "Distribuciones estables respecto al baseline de entrenamiento.",
              variables_drift: {
                installment_payment_ratio: { psi: 0.032, status: "NORMAL" },
                debt_to_income_ratio: { psi: 0.045, status: "NORMAL" },
                credit_annuity_ratio: { psi: 0.021, status: "NORMAL" },
              },
            },
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        telemetry: metricsData?.service_telemetry,
        prediction_health: metricsData?.prediction_health,
        data_drift: driftData?.drift_report,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "MONITORING_FETCH_ERROR",
          message: error instanceof Error ? error.message : "Error al consultar telemetría MLOps",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";

  try {
    const body = await req.json().catch(() => ({}));
    const scenario = body.scenario || "economic_stress";
    const count = body.count || 50;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${mlServiceUrl}/drift/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, scenario }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      {
        success: false,
        message: `El microservicio ML retornó HTTP ${res.status}`,
      },
      { status: res.status }
    );
  } catch {
    return NextResponse.json(
      {
        success: true,
        message: "Simulación de drift local (FastAPI no conectado).",
        simulation_result: {
          scenario: "economic_stress",
          status: "CRITICAL",
          highest_psi: 0.284,
          drifted_features_count: 2,
        },
      },
      { status: 200 }
    );
  }
}
