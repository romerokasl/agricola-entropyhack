import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const PredictionSchema = z.object({
  customerId: z.string().default("CUST_DEMO"),
  monthlyIncome: z.number().min(0).default(850.0),
  debtToIncome: z.number().min(0).max(2.0).default(0.45),
  creditUtilization: z.number().min(0).max(3.0).default(0.75),
  savingsDrop: z.number().min(-1.0).max(1.0).default(0.30),
  latePaymentsLast6m: z.number().min(0).max(12).default(1),
  expenseVolatility: z.number().min(0).max(2.0).default(0.25),
  daysToPayment: z.number().min(1).max(60).default(14),
  hasAutoDebit: z.number().min(0).max(1).default(0),
  customerTenureMonths: z.number().min(0).default(24),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = PredictionSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Datos de entrada inválidos para el modelo",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data;
    const mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";

    // 1. Intentar llamar al microservicio de Python FastAPI
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const mlResponse = await fetch(`${mlServiceUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (mlResponse.ok) {
        const mlData = await mlResponse.json();
        return NextResponse.json({
          ...mlData,
          source: "python_fastapi_model",
        });
      }
    } catch {
      // Fallback a continuación si el microservicio en Python no responde
    }

    // 2. Smart Fallback Deterministico (Zero-Downtime para desarrollo y demo)
    const prob = Math.min(
      0.95,
      Math.max(
        0.05,
        payload.creditUtilization * 0.35 +
          payload.debtToIncome * 0.30 +
          Math.max(0, payload.savingsDrop) * 0.20 +
          Math.min(payload.latePaymentsLast6m * 0.15, 0.40) -
          payload.hasAutoDebit * 0.10
      )
    );

    const score = Math.round(prob * 100);
    let level = "LOW";
    if (score >= 75) level = "CRITICAL";
    else if (score >= 55) level = "MODERATE_HIGH";
    else if (score >= 30) level = "MODERATE";

    const riskFactors = [];
    if (payload.creditUtilization > 0.70) {
      riskFactors.push({
        factor: `Uso del ${Math.round(payload.creditUtilization * 100)}% del límite de tarjeta`,
        impact: "+30%",
        severity: "HIGH",
      });
    }
    if (payload.savingsDrop > 0.20) {
      riskFactors.push({
        factor: `Disminución de ahorros del ${Math.round(payload.savingsDrop * 100)}% en 90 días`,
        impact: "+22%",
        severity: "HIGH",
      });
    }
    if (payload.debtToIncome > 0.40) {
      riskFactors.push({
        factor: `Ingreso altamente comprometido (${Math.round(payload.debtToIncome * 100)}% DTI)`,
        impact: "+18%",
        severity: "MEDIUM",
      });
    }
    if (payload.latePaymentsLast6m > 0) {
      riskFactors.push({
        factor: `${payload.latePaymentsLast6m} cuota(s) con atraso reciente`,
        impact: "+15%",
        severity: "MEDIUM",
      });
    }

    const adviceMap: Record<string, { action: string; message: string; solution: string }> = {
      LOW: {
        action: "STANDARD_FOLLOW_UP",
        message: "Tu salud crediticia se mantiene excelente. ¡Gracias por tu puntualidad!",
        solution: "Monitoreo preventivo rutinario sin acción de pago requerida.",
      },
      MODERATE: {
        action: "FRIENDLY_REMINDER",
        message: `Faltan ${payload.daysToPayment} días para tu vencimiento. Activa débito automático y ahorra tiempo mientras proteges tu récord crediticio.`,
        solution: "Sugerencia de activación de débito automático o recordatorio vía app.",
      },
      MODERATE_HIGH: {
        action: "SPLIT_PAYMENT",
        message:
          "Notamos que este mes tus gastos han sido más altos. En Bancoagrícola estamos para apoyarte: puedes dividir tu cuota en dos pagos quincenales sin ningún recargo.",
        solution: "Fraccionamiento de cuota en 2 quincenas sin recargos ni penalizaciones.",
      },
      CRITICAL: {
        action: "EMPATHETIC_RESTRUCTURING",
        message:
          "Queremos proteger tu historial financiero antes de tu fecha límite. Hemos diseñado una readecuación personalizada con plazo extendido y cuota reducida a tu medida.",
        solution: "Plan de readecuación preventiva inmediata con 1 click desde la banca digital.",
      },
    };

    const advice = adviceMap[level];

    return NextResponse.json({
      success: true,
      data: {
        customerId: payload.customerId,
        riskScore: score,
        riskLevel: level,
        defaultProbability: Number(prob.toFixed(4)),
        daysUntilNextPayment: payload.daysToPayment,
        topRiskFactors: riskFactors,
        recommendedAction: advice.action,
        suggestedSolution: advice.solution,
        empatheticMessage: advice.message,
      },
      source: "nextjs_smart_fallback",
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: errMessage },
      },
      { status: 500 }
    );
  }
}
