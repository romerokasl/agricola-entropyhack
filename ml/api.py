"""
Microservicio FastAPI ultrarrápido para inferencia de riesgo de mora y explicabilidad.
Listo para despliegue en local, Render, Railway o Modal.
"""

import json
import os
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="Bancoagrícola Pre-Mora Early Warning API",
    description="Microservicio de inferencia preventiva para detección temprana de riesgo crediticio y asesoría empática.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")
META_PATH = os.path.join(os.path.dirname(__file__), "model_meta.json")

model = None
metadata = {}


@app.on_event("startup")
def load_model():
    global model, metadata
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print(f"Modelo cargado exitosamente desde {MODEL_PATH}")
        except Exception as e:
            print(f"Error cargando el modelo: {e}")

    if os.path.exists(META_PATH):
        try:
            with open(META_PATH, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except Exception as e:
            print(f"Error cargando metadatos: {e}")


class PredictionInput(BaseModel):
    customerId: str = Field(default="CUST_0001", description="Identificador único del cliente")
    monthlyIncome: float = Field(default=850.0, ge=0, description="Ingreso mensual en USD")
    debtToIncome: float = Field(default=0.45, ge=0, le=1.5, description="Ratio deuda sobre ingreso (DTI)")
    creditUtilization: float = Field(default=0.75, ge=0, le=2.0, description="Porcentaje de uso de línea de crédito")
    savingsDrop: float = Field(default=0.30, ge=-1.0, le=1.0, description="Disminución de ahorros en últimos 3 meses")
    latePaymentsLast6m: int = Field(default=1, ge=0, le=12, description="Cuotas con atraso en el último semestre")
    expenseVolatility: float = Field(default=0.25, ge=0, le=1.0, description="Volatilidad de egresos recientes")
    daysToPayment: int = Field(default=14, ge=1, le=45, description="Días restantes para el próximo vencimiento")
    hasAutoDebit: int = Field(default=0, ge=0, le=1, description="Débito automático activo (1: sí, 0: no)")
    customerTenureMonths: int = Field(default=24, ge=0, description="Antigüedad en meses con Bancoagrícola")


def generate_empathetic_advice(risk_level: str, days_to_payment: int) -> dict:
    """Genera recomendaciones preventivas con el tono empático y aliado de Bancoagrícola."""
    if risk_level == "LOW":
        return {
            "action": "STANDARD_FOLLOW_UP",
            "message": "Tu historial crediticio se mantiene impecable. ¡Gracias por tu puntualidad!",
            "suggested_solution": "Sin acción requerida. Mantener monitoreo regular."
        }
    elif risk_level == "MODERATE":
        return {
            "action": "FRIENDLY_REMINDER_AND_SAVINGS_TIP",
            "message": f"Faltan {days_to_payment} días para tu próxima fecha de pago. ¿Te gustaría activar débito automático para evitar olvidos y proteger tu récord crediticio?",
            "suggested_solution": "Recordatorio amistoso con opción de activación de débito automático o micro-ahorro programado."
        }
    elif risk_level == "MODERATE_HIGH":
        return {
            "action": "PREVENTIVE_FLEXIBILITY",
            "message": "Notamos que este mes tus gastos han sido más altos de lo habitual. En Bancoagrícola queremos ser tu aliado: si prevés dificultades con tu cuota de este mes, podemos dividirla en dos partes sin intereses moratorios.",
            "suggested_solution": "Plan de pago dividido en 2 quincenas o reprogramación de fecha sin penalización."
        }
    else:  # CRITICAL
        return {
            "action": "EMPATHETIC_RESTRUCTURING",
            "message": "Queremos proteger tu historial crediticio antes de tu fecha límite. Hemos preparado una propuesta de readecuación de cuota personalizada con menor tasa y plazo extendido. Tú eliges el plan que mejor se adapte a tu bolsillo.",
            "suggested_solution": "Readecuación de crédito preventiva inmediata vía app móvil sin afectar calificación bancaria."
        }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "Bancoagrícola ML Inference Service",
        "model_loaded": model is not None,
        "model_type": metadata.get("model_type", "Pending Training"),
        "metrics": metadata.get("metrics", {}),
    }


@app.post("/predict")
def predict_risk(input_data: PredictionInput):
    # Vector de características
    features = [
        input_data.monthlyIncome,
        input_data.debtToIncome,
        input_data.creditUtilization,
        input_data.savingsDrop,
        input_data.latePaymentsLast6m,
        input_data.expenseVolatility,
        input_data.daysToPayment,
        input_data.hasAutoDebit,
        input_data.customerTenureMonths,
    ]

    if model is not None:
        try:
            prob = float(model.predict_proba([features])[0][1])
        except Exception:
            prob = 0.5
    else:
        # Cálculo heurístico mientras se compila el modelo
        prob = (
            input_data.creditUtilization * 0.35
            + input_data.debtToIncome * 0.30
            + max(0, input_data.savingsDrop) * 0.20
            + min(input_data.latePaymentsLast6m * 0.15, 0.40)
            - (input_data.hasAutoDebit * 0.10)
        )
        prob = float(np.clip(prob, 0.05, 0.95))

    score = int(round(prob * 100))

    if score < 30:
        level = "LOW"
    elif score < 55:
        level = "MODERATE"
    elif score < 75:
        level = "MODERATE_HIGH"
    else:
        level = "CRITICAL"

    # Factores principales
    risk_factors = []
    if input_data.creditUtilization > 0.70:
        risk_factors.append({"factor": f"Línea de crédito ocupada al {int(input_data.creditUtilization * 100)}%", "severity": "HIGH"})
    if input_data.savingsDrop > 0.25:
        risk_factors.append({"factor": f"Disminución de ahorros del {int(input_data.savingsDrop * 100)}% en 3 meses", "severity": "HIGH"})
    if input_data.debtToIncome > 0.40:
        risk_factors.append({"factor": f"Compromiso de ingresos alto ({int(input_data.debtToIncome * 100)}% DTI)", "severity": "MEDIUM"})
    if input_data.latePaymentsLast6m > 0:
        risk_factors.append({"factor": f"{input_data.latePaymentsLast6m} atraso(s) en cuotas recientes", "severity": "MEDIUM"})

    advice = generate_empathetic_advice(level, input_data.daysToPayment)

    return {
        "success": True,
        "data": {
            "customerId": input_data.customerId,
            "riskScore": score,
            "riskLevel": level,
            "defaultProbability": round(prob, 4),
            "daysUntilNextPayment": input_data.daysToPayment,
            "topRiskFactors": risk_factors,
            "recommendedAction": advice["action"],
            "suggestedSolution": advice["suggested_solution"],
            "empatheticMessage": advice["message"],
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
