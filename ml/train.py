"""
Pipeline de entrenamiento para detección preventiva de mora crediticia.
Soporta LightGBM, XGBoost y Scikit-Learn HistGradientBoosting como fallback.
Calcula métricas de evaluación y exporta el modelo y metadatos de explicabilidad.
"""

import argparse
import json
import os
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, roc_auc_score, brier_score_loss
from sklearn.model_selection import train_test_split

from synthetic_data import generate_synthetic_credit_data

FEATURE_COLUMNS = [
    "monthly_income",
    "debt_to_income",
    "credit_utilization",
    "savings_drop",
    "late_payments_last_6m",
    "expense_volatility",
    "days_to_payment",
    "has_auto_debit",
    "customer_tenure_months",
]

TARGET_COLUMN = "target_default"


def get_best_model():
    """
    Intenta instanciar LightGBM o XGBoost; si no están compilados en el entorno,
    usa HistGradientBoostingClassifier de scikit-learn (mismo algoritmo, ultra rápido).
    """
    try:
        import lightgbm as lgb
        print("Usando LightGBM Classifier (LGBMClassifier)")
        return lgb.LGBMClassifier(
            n_estimators=200,
            learning_rate=0.05,
            num_leaves=31,
            random_state=42,
            n_jobs=-1
        ), "LightGBM"
    except ImportError:
        pass

    try:
        import xgboost as xgb
        print("Usando XGBoost Classifier (XGBClassifier con tree_method='hist')")
        return xgb.XGBClassifier(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=5,
            tree_method="hist",
            random_state=42,
            n_jobs=-1,
            eval_metric="logloss"
        ), "XGBoost"
    except ImportError:
        pass

    from sklearn.ensemble import HistGradientBoostingClassifier
    print("Usando Scikit-Learn HistGradientBoostingClassifier (Fallback nativo ultrarrápido)")
    return HistGradientBoostingClassifier(
        max_iter=200,
        learning_rate=0.05,
        max_leaf_nodes=31,
        random_state=42
    ), "HistGradientBoosting"


def train_pipeline(data_path: str = None, rows: int = 100000, output_dir: str = "ml"):
    os.makedirs(output_dir, exist_ok=True)

    if data_path and os.path.exists(data_path):
        print(f"Cargando dataset desde {data_path}...")
        df = pd.read_csv(data_path)
    else:
        print(f"Generando {rows:,} registros sintéticos para entrenamiento...")
        df = generate_synthetic_credit_data(n_samples=rows)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    model, model_type = get_best_model()

    print(f"Entrenando modelo en {len(X_train):,} registros...")
    start_time = time.time()
    model.fit(X_train, y_train)
    duration = time.time() - start_time
    print(f"Entrenamiento completado en {duration:.2f} segundos!")

    # Predicciones y métricas
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    auc = roc_auc_score(y_test, y_pred_proba)
    brier = brier_score_loss(y_test, y_pred_proba)

    print(f"\n--- Métricas del Modelo ({model_type}) ---")
    print(f"ROC-AUC: {auc:.4f}")
    print(f"Brier Score (Calibración): {brier:.4f}")
    print("\nReporte de Clasificación:")
    print(classification_report(y_test, y_pred, digits=4))

    # Guardar modelo
    model_file = os.path.join(output_dir, "model.joblib")
    joblib.dump(model, model_file)
    print(f"Modelo guardado en {model_file}")

    # Guardar metadatos para la API
    meta = {
        "model_type": model_type,
        "features": FEATURE_COLUMNS,
        "metrics": {
            "roc_auc": round(float(auc), 4),
            "brier_score": round(float(brier), 4),
            "trained_rows": len(df),
            "training_time_seconds": round(duration, 2),
        },
        "feature_descriptions": {
            "monthly_income": "Ingreso mensual declarado del cliente en USD",
            "debt_to_income": "Porcentaje del ingreso comprometido con deudas (DTI)",
            "credit_utilization": "Porcentaje de uso de su línea de crédito disponible",
            "savings_drop": "Disminución en el saldo de su cuenta de ahorro en los últimos 3 meses",
            "late_payments_last_6m": "Número de cuotas pagadas con atraso en el último semestre",
            "expense_volatility": "Fluctuación anormal de gastos en los últimos 60 días",
            "days_to_payment": "Días restantes para el vencimiento de la próxima cuota",
            "has_auto_debit": "Tiene contratado débito automático en cuenta",
            "customer_tenure_months": "Antigüedad del cliente con Bancoagrícola en meses",
        }
    }

    meta_file = os.path.join(output_dir, "model_meta.json")
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"Metadatos guardados en {meta_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrenar modelo preventivo de mora")
    parser.add_argument("--data", type=str, default=None, help="Ruta de archivo CSV de entrenamiento")
    parser.add_argument("--rows", type=int, default=100000, help="Registros sintéticos si no hay archivo")
    args = parser.parse_args()

    train_pipeline(data_path=args.data, rows=args.rows)
