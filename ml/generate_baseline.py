"""
Script para generar el perfil estadístico de referencia (Baseline Statistics)
a partir de los datos de entrenamiento.

Guarda los cortes interiores y las proporciones empíricas exactas para cada variable,
permitiendo el cálculo del Population Stability Index (PSI) y KS-test con total rigor bancario.
"""

import json
import os
import numpy as np
import pandas as pd
import joblib

DATA_DIR = os.path.expanduser(r"~/.cache/kagglehub/competitions/home-credit-default-risk")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "baseline_stats.json")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_abcd.pkl")


def generar_perfil_referencia():
    print("Iniciando generación de perfil estadístico de referencia (Baseline)...")

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"No se encontró el modelo entrenado en {MODEL_PATH}")

    # 1. Cargar datos de entrenamiento
    print("Cargando muestra de entrenamiento para extraer cuantiles y proporciones...")
    app_df = pd.read_csv(os.path.join(DATA_DIR, "application_train.csv"), nrows=60000)

    # Limpieza idéntica a la del entrenamiento
    app_df = app_df[app_df["AMT_INCOME_TOTAL"] < 50_000_000].copy()
    app_df["DAYS_EMPLOYED_ANOM"] = (app_df["DAYS_EMPLOYED"] == 365243).astype(int)
    app_df["DAYS_EMPLOYED"] = app_df["DAYS_EMPLOYED"].replace(365243, np.nan)
    app_df["CODE_GENDER"] = app_df["CODE_GENDER"].replace("XNA", "F")
    app_df["age_in_years"] = (-app_df["DAYS_BIRTH"] // 365).astype(int)

    # Ratios
    app_df["credit_annuity_ratio"] = app_df["AMT_CREDIT"] / (app_df["AMT_ANNUITY"] + 1e-5)
    app_df["credit_goods_price_ratio"] = app_df["AMT_CREDIT"] / (app_df["AMT_GOODS_PRICE"] + 1e-5)
    app_df["credit_downpayment"] = app_df["AMT_GOODS_PRICE"] - app_df["AMT_CREDIT"]
    app_df["debt_to_income_ratio"] = app_df["AMT_CREDIT"] / (app_df["AMT_INCOME_TOTAL"] + 1e-5)
    app_df["annuity_income_ratio"] = app_df["AMT_ANNUITY"] / (app_df["AMT_INCOME_TOTAL"] + 1e-5)

    # Cargar cuotas
    print("Extrayendo estadísticas de cuotas históricas...")
    inst_df = pd.read_csv(os.path.join(DATA_DIR, "installments_payments.csv"), nrows=500000)
    inst_df["delay_days"] = inst_df["DAYS_ENTRY_PAYMENT"] - inst_df["DAYS_INSTALMENT"]
    inst_df["delay_days_clean"] = inst_df["delay_days"].clip(upper=365)
    inst_df.loc[inst_df["DAYS_ENTRY_PAYMENT"].isnull(), "delay_days_clean"] = 365.0
    inst_df.loc[inst_df["AMT_PAYMENT"].isnull(), "AMT_PAYMENT"] = 0.0
    inst_df["payment_diff"] = inst_df["AMT_PAYMENT"] - inst_df["AMT_INSTALMENT"]

    kpi_cuotas = inst_df.groupby("SK_ID_CURR").agg(
        installment_payment_ratio=("payment_diff", "mean"),
        max_monto_cuota_historico=("AMT_INSTALMENT", "max")
    ).reset_index()

    rec_90 = inst_df[inst_df["DAYS_INSTALMENT"] >= -90].groupby("SK_ID_CURR").agg(
        delay_days_clean_max_90dias=("delay_days_clean", "max")
    ).reset_index()

    datos_completos = app_df.merge(kpi_cuotas, on="SK_ID_CURR", how="inner")
    datos_completos = datos_completos.merge(rec_90, on="SK_ID_CURR", how="left")
    datos_completos["delay_days_clean_max_90dias"] = datos_completos["delay_days_clean_max_90dias"].fillna(0.0)

    # Variables críticas para Data Drift
    variables_clave_drift = [
        "installment_payment_ratio",
        "debt_to_income_ratio",
        "credit_annuity_ratio",
        "AMT_INCOME_TOTAL",
        "AMT_CREDIT",
        "AMT_ANNUITY",
        "age_in_years",
        "delay_days_clean_max_90dias",
        "EXT_SOURCE_2",
        "EXT_SOURCE_3"
    ]

    perfil_variables = {}
    cuantiles_deciles = np.linspace(0.0, 1.0, 11)

    for var in variables_clave_drift:
        if var in datos_completos.columns:
            serie = datos_completos[var].dropna()
            if len(serie) > 100:
                raw_bins = np.quantile(serie, cuantiles_deciles).tolist()
                bins_unicos = sorted(list(set(raw_bins)))
                if len(bins_unicos) < 3:
                    bins_unicos = [float(serie.min()), float(serie.median()), float(serie.max())]

                interior_cuts = bins_unicos[1:-1]
                bin_indices = np.digitize(serie.values, interior_cuts)
                n_bins = len(interior_cuts) + 1
                counts = np.bincount(bin_indices, minlength=n_bins)
                proporciones_esperadas = (
                    (counts + 1e-4) / (len(serie) + 1e-4 * n_bins)
                ).tolist()

                perfil_variables[var] = {
                    "count": int(len(serie)),
                    "mean": float(serie.mean()),
                    "std": float(serie.std()),
                    "median": float(serie.median()),
                    "min": float(serie.min()),
                    "max": float(serie.max()),
                    "interior_cuts": interior_cuts,
                    "expected_proportions": proporciones_esperadas
                }

    columnas_muestra = [v for v in variables_clave_drift if v in datos_completos.columns]
    muestra_real = datos_completos[columnas_muestra].dropna().head(300).to_dict(orient="records")

    distribucion_clases_esperada = {
        "Healthy": 0.4698,
        "A1": 0.3533,
        "A2": 0.1111,
        "B": 0.0338,
        "C": 0.0080,
        "D_E": 0.0240
    }

    perfil_consolidado = {
        "version": "1.0.0",
        "modelo": "LightGBM-Multiclass-SSF",
        "total_muestras_referencia": int(len(datos_completos)),
        "distribucion_clases_esperada": distribucion_clases_esperada,
        "variables_monitoreadas": perfil_variables,
        "muestra_referencia_normal": muestra_real
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(perfil_consolidado, f, indent=2, ensure_ascii=False)

    print(f"Perfil de referencia guardado exitosamente en: {OUTPUT_PATH}")
    print(f"Variables monitoreadas para Data Drift: {len(perfil_variables)}")


if __name__ == "__main__":
    generar_perfil_referencia()
