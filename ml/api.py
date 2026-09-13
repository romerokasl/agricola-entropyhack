"""
Microservicio FastAPI ultrarrápido para inferencia de riesgo de mora,
explicabilidad empática y observabilidad MLOps (Data Drift & Model Health).
"""

import json
import os
import time
from typing import Dict, List, Optional, Any
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Módulo de observabilidad y Data Drift
try:
    from ml.monitoring import monitor_singleton
except ImportError:
    from monitoring import monitor_singleton

app = FastAPI(
    title="Bancoagrícola Pre-Mora Early Warning API",
    description="Microservicio de inferencia preventiva para detección temprana de riesgo crediticio, asesoría empática y observabilidad MLOps.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH_PKL = os.path.join(os.path.dirname(__file__), "model_abcd.pkl")
MODEL_PATH_JOBLIB = os.path.join(os.path.dirname(__file__), "model.joblib")

model = None
model_metadata = {}
feature_names = []
class_mapping = {0: "Healthy", 1: "A1", 2: "A2", 3: "B", 4: "C", 5: "D_E"}


@app.on_event("startup")
def load_model_and_artifacts():
    global model, model_metadata, feature_names, class_mapping

    # Intentar cargar el modelo entrenado con normativa SSF (model_abcd.pkl)
    if os.path.exists(MODEL_PATH_PKL):
        try:
            artifact = joblib.load(MODEL_PATH_PKL)
            if isinstance(artifact, dict) and "modelo" in artifact:
                model = artifact["modelo"]
                feature_names = artifact.get("columnas_caracteristicas", [])
                class_mapping = artifact.get("diccionario_clases", class_mapping)
                model_metadata = {
                    "model_type": artifact.get("nombre_modelo", "LightGBM-Multiclass-SSF"),
                    "classes": class_mapping,
                    "num_features": len(feature_names),
                    "source": "model_abcd.pkl"
                }
            else:
                model = artifact
                model_metadata = {"model_type": "LightGBM", "source": "model_abcd.pkl"}
            print(f"[Startup] Modelo SSF cargado exitosamente desde {MODEL_PATH_PKL}")
        except Exception as e:
            print(f"[Startup] Error cargando {MODEL_PATH_PKL}: {e}")

    # Fallback al joblib si no existe el pkl
    if model is None and os.path.exists(MODEL_PATH_JOBLIB):
        try:
            model = joblib.load(MODEL_PATH_JOBLIB)
            model_metadata = {"model_type": "Joblib-Fallback", "source": "model.joblib"}
            print(f"[Startup] Modelo cargado desde fallback {MODEL_PATH_JOBLIB}")
        except Exception as e:
            print(f"[Startup] Error cargando {MODEL_PATH_JOBLIB}: {e}")


# ------------------------------------------------------------------------------
# MODELOS PYDANTIC
# ------------------------------------------------------------------------------
class PredictionInput(BaseModel):
    customerId: str = Field(default="CUST_0001", description="Identificador único del cliente")
    monthlyIncome: float = Field(default=850.0, ge=0, description="Ingreso mensual en USD")
    debtToIncomeRatio: Optional[float] = Field(default=None, description="Ratio deuda sobre ingreso (DTI)")
    debtToIncome: Optional[float] = Field(default=None, description="Alias para debtToIncomeRatio")
    creditLineUtilization: Optional[float] = Field(default=None, description="Porcentaje de uso de línea de crédito")
    creditUtilization: Optional[float] = Field(default=None, description="Alias para creditLineUtilization")
    savingsDropPct: Optional[float] = Field(default=None, description="Disminución de ahorros en últimos 3 meses")
    savingsDrop: Optional[float] = Field(default=None, description="Alias para savingsDropPct")
    latePaymentsLast6m: int = Field(default=0, ge=0, le=12, description="Cuotas con atraso en el último semestre")
    daysUntilNextPayment: Optional[int] = Field(default=14, ge=1, le=45, description="Días restantes para el vencimiento")
    daysToPayment: Optional[int] = Field(default=None, description="Alias para daysUntilNextPayment")
    recentPaymentDifference: Optional[float] = Field(default=0.0, description="Diferencia de pago en última cuota (USD)")

    def get_dti(self) -> float:
        return self.debtToIncomeRatio if self.debtToIncomeRatio is not None else (self.debtToIncome if self.debtToIncome is not None else 0.35)

    def get_utilization(self) -> float:
        return self.creditLineUtilization if self.creditLineUtilization is not None else (self.creditUtilization if self.creditUtilization is not None else 0.50)

    def get_savings_drop(self) -> float:
        return self.savingsDropPct if self.savingsDropPct is not None else (self.savingsDrop if self.savingsDrop is not None else 0.10)

    def get_days_to_payment(self) -> int:
        return self.daysUntilNextPayment if self.daysUntilNextPayment is not None else (self.daysToPayment if self.daysToPayment is not None else 14)


class DriftSimulationRequest(BaseModel):
    count: int = Field(default=50, ge=10, le=500, description="Número de solicitudes sintéticas a generar")
    scenario: str = Field(default="normal", description="Escenario a simular: 'normal', 'economic_stress', 'mild_warning'")


# ------------------------------------------------------------------------------
# GENERACIÓN DE MENSAJES EMPÁTICOS (BANCO AGRÍCOLA)
# ------------------------------------------------------------------------------
def generate_empathetic_advice(risk_level: str, days_to_payment: int) -> dict:
    """Genera recomendaciones preventivas con el tono empático y aliado de Banco Agrícola."""
    if risk_level == "LOW":
        return {
            "action": "STANDARD_FOLLOW_UP",
            "message": "Tu salud crediticia se mantiene excelente. ¡Gracias por tu compromiso y puntualidad!",
            "suggested_solution": "Sin acción requerida. Mantener monitoreo regular y beneficios vigentes."
        }
    elif risk_level == "MODERATE":
        return {
            "action": "FRIENDLY_REMINDER_AND_SAVINGS_TIP",
            "message": f"Faltan {days_to_payment} días para tu próxima fecha de pago. Queremos ayudarte a cuidar tu récord crediticio: ¿deseas programar un recordatorio o activar débito automático?",
            "suggested_solution": "Recordatorio amistoso con opción de activación de micro-abono o débito automático."
        }
    elif risk_level == "MODERATE_HIGH":
        return {
            "action": "PAYMENT_RESTRUCTURING",
            "message": "Notamos que este mes tus gastos han aumentado. En Banco Agrícola somos tu aliado: te ofrecemos dividir tu cuota en dos partes o reprogramar la fecha sin intereses moratorios.",
            "suggested_solution": "División de cuota en dos pagos quincenales o reprogramación sin penalización en el récord."
        }
    else:  # CRITICAL
        return {
            "action": "EMPATHETIC_RESTRUCTURING",
            "message": "Queremos proteger tu historial crediticio antes de tu fecha de pago. Hemos preparado una propuesta de readecuación personalizada con menor cuota y mayor plazo a tu medida.",
            "suggested_solution": "Readecuación preventiva inmediata vía app móvil sin afectar calificación bancaria."
        }


# ------------------------------------------------------------------------------
# ENDPOINTS DE SALUD Y OBSERVABILIDAD (HEALTH CHECKS & MLOPS)
# ------------------------------------------------------------------------------
@app.get("/health")
def health_check():
    """Probe de salud compatible con la especificación .agents/skills/health-checks/."""
    service_metrics = monitor_singleton.get_service_metrics()
    drift_report = monitor_singleton.get_data_drift_report()

    status = "ok" if model is not None else "degraded"

    return {
        "status": status,
        "service": "Bancoagrícola ML Inference Service",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_loaded": model is not None,
        "model_type": model_metadata.get("model_type", "Pending Training"),
        "latency_p95_ms": service_metrics["latency_ms"]["p95"],
        "drift_status": drift_report.get("status", "INSUFFICIENT_DATA"),
        "uptime_seconds": service_metrics["uptime_seconds"],
    }


@app.get("/metrics")
def get_ml_metrics():
    """Retorna la telemetría consolidada de rendimiento, latencia y distribución de clases."""
    return {
        "success": True,
        "service_telemetry": monitor_singleton.get_service_metrics(),
        "prediction_health": monitor_singleton.get_prediction_health(),
    }


@app.get("/drift")
def get_drift_report():
    """Reporte detallado de Data Drift por variable con valores de PSI y KS-test."""
    return {
        "success": True,
        "drift_report": monitor_singleton.get_data_drift_report(),
        "prediction_drift": monitor_singleton.get_prediction_health(),
    }


@app.post("/drift/simulate")
def simulate_drift_traffic(request: DriftSimulationRequest):
    """
    Simula tráfico sintético para demostrar en vivo la detección de Data Drift
    ante cambios macroeconómicos o estrés de cartera.
    """
    result = monitor_singleton.simulate_traffic(
        count=request.count,
        scenario=request.scenario
    )
    return {
        "success": True,
        "simulation_result": result
    }


# ------------------------------------------------------------------------------
# ENDPOINT DE INFERENCIA PREVENTIVA
# ------------------------------------------------------------------------------
@app.post("/predict")
def predict_risk(input_data: PredictionInput):
    t_start = time.perf_counter()
    used_model = False

    dti = input_data.get_dti()
    utilization = input_data.get_utilization()
    savings_drop = input_data.get_savings_drop()
    days_to_payment = input_data.get_days_to_payment()
    monthly_income = max(50.0, input_data.monthlyIncome)

    # Construir features compatibles
    income_annual = monthly_income * 12
    estimated_credit = income_annual * dti
    estimated_annuity = estimated_credit / 24.0

    feature_dict = {
        "installment_payment_ratio": input_data.recentPaymentDifference,
        "debt_to_income_ratio": dti * 10.0,
        "credit_annuity_ratio": estimated_credit / (estimated_annuity + 1e-5),
        "AMT_INCOME_TOTAL": income_annual,
        "AMT_CREDIT": estimated_credit,
        "AMT_ANNUITY": estimated_annuity,
        "age_in_years": 38,
        "delay_days_clean_max_90dias": float(input_data.latePaymentsLast6m * 15),
        "EXT_SOURCE_2": float(np.clip(1.0 - (utilization * 0.7), 0.05, 0.95)),
        "EXT_SOURCE_3": float(np.clip(1.0 - (savings_drop * 0.6), 0.05, 0.95))
    }

    prob_default = 0.5
    predicted_class = "A1"

    if model is not None:
        try:
            # Si el modelo fue entrenado con las 205 características completas
            if feature_names:
                row_dict = {col: 0.0 for col in feature_names}
                for k, v in feature_dict.items():
                    if k in row_dict:
                        row_dict[k] = v
                input_df = pd.DataFrame([row_dict])
                prob_array = model.predict_proba(input_df)[0]
            else:
                # Fallback de features compactas
                compact_features = [
                    monthly_income, dti, utilization, savings_drop,
                    input_data.latePaymentsLast6m, 0.25, days_to_payment, 0, 24
                ]
                prob_array = model.predict_proba([compact_features])[0]

            # Probabilidad de mora acumulada (clases A1 a D_E)
            if len(prob_array) == 6:
                prob_default = float(1.0 - prob_array[0])  # 1.0 - P(Healthy)
                pred_idx = int(np.argmax(prob_array))
                predicted_class = class_mapping.get(pred_idx, "A1")
            else:
                prob_default = float(prob_array[1])
                predicted_class = "A2" if prob_default > 0.6 else "Healthy"

            used_model = True
        except Exception as e:
            print(f"[Predict] Error ejecutando modelo real: {e}")
            used_model = False

    if not used_model:
        # Fallback heurístico determinista garantizado
        prob_default = (
            utilization * 0.35
            + (dti / 1.5) * 0.30
            + max(0.0, savings_drop) * 0.20
            + min(input_data.latePaymentsLast6m * 0.15, 0.40)
        )
        prob_default = float(np.clip(prob_default, 0.05, 0.95))
        if prob_default < 0.30:
            predicted_class = "Healthy"
        elif prob_default < 0.55:
            predicted_class = "A1"
        elif prob_default < 0.75:
            predicted_class = "A2"
        else:
            predicted_class = "B"

    risk_score = int(round(prob_default * 100))

    if risk_score < 30:
        level = "LOW"
    elif risk_score < 55:
        level = "MODERATE"
    elif risk_score < 75:
        level = "MODERATE_HIGH"
    else:
        level = "CRITICAL"

    # Factores de riesgo explicables (formato contrato AGENTS.md)
    risk_factors = []
    if utilization > 0.70:
        risk_factors.append({
            "factor": f"Utilización de línea de crédito alta (>{int(utilization*100)}%)",
            "impact": f"+{int(utilization * 35)}%"
        })
    if savings_drop > 0.20:
        risk_factors.append({
            "factor": "Caída en saldo de ahorros en últimos 3 meses",
            "impact": f"+{int(savings_drop * 40)}%"
        })
    if dti > 0.40:
        risk_factors.append({
            "factor": "Ratio deuda/ingreso superior al umbral óptimo",
            "impact": f"+{int(dti * 25)}%"
        })
    if input_data.latePaymentsLast6m > 0:
        risk_factors.append({
            "factor": f"{input_data.latePaymentsLast6m} atraso(s) en cuotas recientes",
            "impact": f"+{int(input_data.latePaymentsLast6m * 15)}%"
        })
    if not risk_factors:
        risk_factors.append({
            "factor": "Comportamiento crediticio regular y puntual",
            "impact": "0%"
        })

    advice = generate_empathetic_advice(level, days_to_payment)

    # Medir latencia y registrar telemetría
    latency_ms = (time.perf_counter() - t_start) * 1000.0
    monitor_singleton.record_inference(
        latency_ms=latency_ms,
        predicted_class=predicted_class,
        risk_score=risk_score,
        feature_dict=feature_dict,
        used_model=used_model
    )

    return {
        "success": True,
        "data": {
            "customerId": input_data.customerId,
            "riskScore": risk_score,
            "riskLevel": level,
            "predictedArrearsClass": predicted_class,
            "defaultProbability": round(prob_default, 4),
            "daysUntilNextPayment": days_to_payment,
            "preventiveActionRecommended": advice["action"],
            "topRiskFactors": risk_factors,
            "suggestedSolution": advice["suggested_solution"],
            "empatheticMessage": advice["message"],
        },
        "meta": {
            "latencyMs": round(latency_ms, 2),
            "modelType": model_metadata.get("model_type", "Heuristic-Fallback"),
            "usedRealModel": used_model
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
