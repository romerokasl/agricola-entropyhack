import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const mlServiceUrl = process.env.ML_SERVICE_URL || "http://localhost:8000";

  let mlStatus: { status: string; latencyMs?: number; message?: string; details?: unknown } = {
    status: "unreachable",
    message: "ML service not running at " + mlServiceUrl,
  };

  try {
    const mlStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${mlServiceUrl}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      mlStatus = {
        status: "up",
        latencyMs: Date.now() - mlStart,
        message: "FastAPI inference service ready",
        details: data,
      };
    } else {
      mlStatus = {
        status: "degraded",
        latencyMs: Date.now() - mlStart,
        message: `Returned HTTP ${res.status}`,
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    mlStatus = {
      status: "fallback_mode",
      message: `FastAPI offline (${message}). Smart fallback activo en Next.js.`,
    };
  }

  // Supabase Status check
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://example.supabase.co"
  );

  const totalLatency = Date.now() - startTime;
  const isHealthy = mlStatus.status === "up" || mlStatus.status === "fallback_mode";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
      services: {
        nextjs: {
          status: "up",
          latencyMs: totalLatency,
        },
        ml_service: mlStatus,
        supabase: {
          status: supabaseConfigured ? "configured" : "pending_credentials",
          message: supabaseConfigured
            ? "Conectado a proyecto Supabase"
            : "Pendiente configurar NEXT_PUBLIC_SUPABASE_URL en .env",
        },
      },
    },
    { status: 200 }
  );
}
