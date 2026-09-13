"""
Módulo de Procesamiento de Datos, Limpieza e Ingeniería de Características
para el Sistema de Alerta Temprana de Banco Agrícola.

Alineado a la normativa salvadoreña de la Superintendencia del Sistema Financiero (SSF)
y al blueprint de características ganadoras de Kaggle.
"""

import os
import time
from functools import reduce
from typing import Dict, Optional, Tuple

import kagglehub
import numpy as np
import pandas as pd


def resolver_directorio_de_datos() -> str:
    """Localiza la ruta del dataset en caché o lo descarga vía kagglehub si no existe."""
    ruta_en_cache = os.path.expanduser(r"~/.cache/kagglehub/competitions/home-credit-default-risk")
    if os.path.exists(ruta_en_cache):
        return ruta_en_cache
    return kagglehub.competition_download("home-credit-default-risk")


def cargar_conjuntos_de_datos(
    ruta_directorio: str,
    filas_solicitudes: Optional[int] = None,
    filas_cuotas: Optional[int] = None,
    filas_buro: Optional[int] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Carga las tres fuentes primarias para el entrenamiento del sistema:
    1. application_train.csv (Perfil socioeconómico y crediticio)
    2. installments_payments.csv (Historial transaccional cuota por cuota)
    3. bureau.csv (Historial de créditos vigentes en el sistema financiero)
    """
    print(f"Iniciando carga de datos desde: {ruta_directorio}")
    t_inicio = time.time()

    tabla_solicitudes = pd.read_csv(
        os.path.join(ruta_directorio, "application_train.csv"),
        nrows=filas_solicitudes
    )
    tabla_cuotas = pd.read_csv(
        os.path.join(ruta_directorio, "installments_payments.csv"),
        nrows=filas_cuotas
    )

    columnas_buro_necesarias = ["SK_ID_CURR", "AMT_CREDIT_SUM", "AMT_CREDIT_SUM_DEBT"]
    tabla_buro = pd.read_csv(
        os.path.join(ruta_directorio, "bureau.csv"),
        usecols=columnas_buro_necesarias,
        nrows=filas_buro
    )

    duracion = time.time() - t_inicio
    print(f"[OK] Carga completada en {duracion:.2f} s")
    print(f"  • Solicitudes: {len(tabla_solicitudes):,} registros x {tabla_solicitudes.shape[1]} columnas")
    print(f"  • Cuotas: {len(tabla_cuotas):,} registros x {tabla_cuotas.shape[1]} columnas")
    print(f"  • Buró: {len(tabla_buro):,} registros x {tabla_buro.shape[1]} columnas")

    return tabla_solicitudes, tabla_cuotas, tabla_buro


def clasificar_tramo_riesgo_ssf(dias_de_atraso: float) -> str:
    """Mapea los días de atraso a la categoría normativa de la Superintendencia SSF."""
    if dias_de_atraso <= 0:
        return "Healthy"
    elif dias_de_atraso <= 14:
        return "A1"
    elif dias_de_atraso <= 30:
        return "A2"
    elif dias_de_atraso <= 60:
        return "B"
    elif dias_de_atraso <= 120:
        return "C"
    else:
        return "D_E"


def construir_target_normativo_ssf(tabla_cuotas: pd.DataFrame) -> pd.DataFrame:
    """
    Construye el objetivo multiclase analizando el historial completo de cuotas.
    Maneja rigurosamente los impagos totales asignando mora máxima (365 días) y pago $0.
    """
    print("Calculando días de mora y target normativo SSF...")
    cuotas = tabla_cuotas.copy()

    # Días de atraso = Fecha de pago real - Fecha pactada
    cuotas["dias_atraso_calculados"] = cuotas["DAYS_ENTRY_PAYMENT"] - cuotas["DAYS_INSTALMENT"]

    # Impagos absolutos
    mascara_sin_pago = cuotas["DAYS_ENTRY_PAYMENT"].isnull()
    cuotas["dias_atraso_limpios"] = cuotas["dias_atraso_calculados"].clip(upper=365)
    cuotas.loc[mascara_sin_pago, "dias_atraso_limpios"] = 365.0
    cuotas.loc[cuotas["AMT_PAYMENT"].isnull(), "AMT_PAYMENT"] = 0.0

    # Máximo atraso histórico por cliente
    resumen = cuotas.groupby("SK_ID_CURR")["dias_atraso_limpios"].max().reset_index()
    resumen.rename(columns={"dias_atraso_limpios": "maximo_atraso_dias_historico"}, inplace=True)
    resumen["clase_morosidad_ssf"] = resumen["maximo_atraso_dias_historico"].apply(clasificar_tramo_riesgo_ssf)

    return resumen


def limpiar_datos_solicitudes(tabla_solicitudes: pd.DataFrame) -> pd.DataFrame:
    """
    Aplica el pipeline de limpieza sobre las solicitudes:
    - Remoción del outlier tipográfico de $117M.
    - Corrección de la anomalía de empleo de 1000 años (365243 -> np.nan).
    - Limpieza categórica de género (moda 'F' para 'XNA').
    - Transformación de edad a número entero positivo (int).
    - Poda de las 47 variables inmobiliarias con alta ausencia.
    """
    print("Limpiando datos de solicitudes...")
    solicitudes = tabla_solicitudes.copy()

    # 1. Outlier de ingresos
    solicitudes = solicitudes[solicitudes["AMT_INCOME_TOTAL"] < 50_000_000].copy()

    # 2. Anomalía de empleo
    solicitudes["dias_empleado_anomalia"] = (solicitudes["DAYS_EMPLOYED"] == 365243).astype(int)
    solicitudes["DAYS_EMPLOYED"] = solicitudes["DAYS_EMPLOYED"].replace(365243, np.nan)

    # 3. Género
    moda_genero = solicitudes["CODE_GENDER"].mode()[0]
    solicitudes["CODE_GENDER"] = solicitudes["CODE_GENDER"].replace("XNA", moda_genero)

    # 4. Edad como entero positivo
    solicitudes["edad_en_anios"] = (-solicitudes["DAYS_BIRTH"] // 365).astype(int)

    # 5. Poda de 47 variables inmobiliarias
    prefijos_inmobiliarios = [
        "APARTMENTS", "BASEMENTAREA", "YEARS_BEGINEXPLUATATION", "YEARS_BUILD",
        "COMMONAREA", "ELEVATORS", "ENTRANCES", "FLOORSMAX", "FLOORSMIN",
        "LANDAREA", "LIVINGAPARTMENTS", "LIVINGAREA", "NONLIVINGAPARTMENTS",
        "NONLIVINGAREA", "FONDKAPREMONT", "HOUSETYPE", "TOTALAREA",
        "WALLSMATERIAL", "EMERGENCYSTATE"
    ]
    columnas_inmobiliarias = [
        col for col in solicitudes.columns if any(p in col for p in prefijos_inmobiliarios)
    ]
    solicitudes.drop(columns=columnas_inmobiliarias, inplace=True, errors="ignore")

    return solicitudes


def construir_ratios_financieros(
    tabla_solicitudes: pd.DataFrame,
    tabla_buro: pd.DataFrame
) -> pd.DataFrame:
    """
    Calcula ratios de solvencia y apalancamiento (Blueprint Kaggle)
    e integra el grado de endeudamiento vigente desde bureau.csv.
    """
    print("Construyendo ratios financieros inteligentes...")
    solicitudes = tabla_solicitudes.copy()

    solicitudes["credit_annuity_ratio"] = solicitudes["AMT_CREDIT"] / (solicitudes["AMT_ANNUITY"] + 1e-5)
    solicitudes["credit_goods_price_ratio"] = solicitudes["AMT_CREDIT"] / (solicitudes["AMT_GOODS_PRICE"] + 1e-5)
    solicitudes["credit_downpayment"] = solicitudes["AMT_GOODS_PRICE"] - solicitudes["AMT_CREDIT"]
    solicitudes["debt_to_income_ratio"] = solicitudes["AMT_CREDIT"] / (solicitudes["AMT_INCOME_TOTAL"] + 1e-5)
    solicitudes["annuity_income_ratio"] = solicitudes["AMT_ANNUITY"] / (solicitudes["AMT_INCOME_TOTAL"] + 1e-5)

    # Buró
    resumen_buro = tabla_buro.groupby("SK_ID_CURR").agg({
        "AMT_CREDIT_SUM": "sum",
        "AMT_CREDIT_SUM_DEBT": "sum"
    }).reset_index()
    resumen_buro["debt_credit_ratio"] = resumen_buro["AMT_CREDIT_SUM_DEBT"] / (resumen_buro["AMT_CREDIT_SUM"] + 1e-5)

    solicitudes = solicitudes.merge(resumen_buro[["SK_ID_CURR", "debt_credit_ratio"]], on="SK_ID_CURR", how="left")
    return solicitudes


def construir_metricas_recencia_cuotas(tabla_cuotas: pd.DataFrame) -> pd.DataFrame:
    """
    Genera agregaciones de recencia temporal (60, 90, 180, 365 días)
    y KPIs de subpago (underpayment).
    """
    print("Construyendo métricas de recencia y subpago en cuotas...")
    cuotas = tabla_cuotas.copy()

    cuotas["dias_atraso"] = cuotas["DAYS_ENTRY_PAYMENT"] - cuotas["DAYS_INSTALMENT"]
    cuotas["dias_atraso_limpios"] = cuotas["dias_atraso"].clip(upper=365)
    cuotas.loc[cuotas["DAYS_ENTRY_PAYMENT"].isnull(), "dias_atraso_limpios"] = 365.0
    cuotas.loc[cuotas["AMT_PAYMENT"].isnull(), "AMT_PAYMENT"] = 0.0
    cuotas["diferencia_de_pago"] = cuotas["AMT_PAYMENT"] - cuotas["AMT_INSTALMENT"]

    # KPIs Globales
    kpis_globales = cuotas.groupby("SK_ID_CURR").agg(
        installment_payment_ratio=("diferencia_de_pago", "mean"),
        max_monto_cuota_historico=("AMT_INSTALMENT", "max")
    ).reset_index()

    dfs_ventanas = [kpis_globales]

    for dias_ventana in [60, 90, 180, 365]:
        sub = cuotas[cuotas["DAYS_INSTALMENT"] >= -dias_ventana]
        agg_w = sub.groupby("SK_ID_CURR").agg({
            "dias_atraso_limpios": ["mean", "max", "sum"],
            "diferencia_de_pago": ["mean", "min", "sum"]
        })
        agg_w.columns = [
            f"{metrica}_{estadistico}_{dias_ventana}dias"
            for metrica, estadistico in agg_w.columns
        ]
        agg_w.reset_index(inplace=True)
        dfs_ventanas.append(agg_w)

    caracteristicas_transaccionales = reduce(
        lambda izq, der: pd.merge(izq, der, on="SK_ID_CURR", how="left"),
        dfs_ventanas
    )
    return caracteristicas_transaccionales


def preparar_matriz_final_modelado(
    solicitudes_con_ratios: pd.DataFrame,
    caracteristicas_cuotas: pd.DataFrame,
    target_clientes: pd.DataFrame
) -> Tuple[pd.DataFrame, pd.Series, Dict[int, str]]:
    """
    Consolida todas las fuentes, codifica variables categóricas
    y separa X (features) e y (etiquetas multiclase).
    """
    print("Consolidando matriz predictiva X y vector y...")
    unificado = solicitudes_con_ratios.merge(
        target_clientes[["SK_ID_CURR", "clase_morosidad_ssf"]],
        on="SK_ID_CURR",
        how="inner"
    )
    unificado = unificado.merge(caracteristicas_cuotas, on="SK_ID_CURR", how="left")

    unificado["annuity_to_max_installment_ratio"] = (
        unificado["AMT_ANNUITY"] / (unificado["max_monto_cuota_historico"] + 1e-5)
    )

    etiquetas_clases = ["Healthy", "A1", "A2", "B", "C", "D_E"]
    mapeo_clases = {cls_name: i for i, cls_name in enumerate(etiquetas_clases)}
    mapeo_inverso = {i: cls_name for cls_name, i in mapeo_clases.items()}

    vector_y = unificado["clase_morosidad_ssf"].map(mapeo_clases).astype(int)

    columnas_descarte = ["SK_ID_CURR", "TARGET", "clase_morosidad_ssf"]
    columnas_features = [c for c in unificado.columns if c not in columnas_descarte]

    matriz_X = unificado[columnas_features].copy()

    # One-Hot Encoding
    categoricas = matriz_X.select_dtypes(include=["object", "category"]).columns.tolist()
    matriz_X = pd.get_dummies(matriz_X, columns=categoricas, drop_first=True)

    # Limpieza de caracteres en nombres de columnas para LightGBM / XGBoost
    matriz_X.columns = [
        c.replace(" ", "_").replace(":", "_").replace("-", "_").replace(",", "_")
        for c in matriz_X.columns
    ]

    print(f"[OK] Matriz X lista: {matriz_X.shape[0]:,} muestras x {matriz_X.shape[1]} características")
    print(f"[OK] Vector y listo: {len(vector_y):,} etiquetas multiclase")
    return matriz_X, vector_y, mapeo_inverso


def ejecutar_pipeline_completo(
    ruta_datos: Optional[str] = None,
    nrows_solicitudes: Optional[int] = None,
    nrows_cuotas: Optional[int] = None
) -> Tuple[pd.DataFrame, pd.Series, Dict[int, str]]:
    """Ejecuta el pipeline completo de ingeniería de datos y retorna X, y, mapeo."""
    if ruta_datos is None:
        ruta_datos = resolver_directorio_de_datos()

    solicitudes, cuotas, buro = cargar_conjuntos_de_datos(
        ruta_datos,
        filas_solicitudes=nrows_solicitudes,
        filas_cuotas=nrows_cuotas
    )

    target_df = construir_target_normativo_ssf(cuotas)
    solicitudes_limpias = limpiar_datos_solicitudes(solicitudes)
    solicitudes_ratios = construir_ratios_financieros(solicitudes_limpias, buro)
    cuotas_recencia = construir_metricas_recencia_cuotas(cuotas)

    return preparar_matriz_final_modelado(solicitudes_ratios, cuotas_recencia, target_df)


if __name__ == "__main__":
    print("Probando ejecución de pipeline con muestra rápida...")
    X, y, mapping = ejecutar_pipeline_completo(nrows_solicitudes=5000, nrows_cuotas=50000)
    print(f"Pipeline verificado exitosamente. Clases: {mapping}")
