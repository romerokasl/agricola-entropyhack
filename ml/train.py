"""
Script de Entrenamiento, Validación Cruzada y Selección de Modelos Multiclase (SSF)
para el Sistema de Alerta Temprana de Banco Agrícola.

Compara 4 algoritmos:
1. LightGBM
2. XGBoost
3. CatBoost
4. Random Forest

Calcula métricas multiclase (Balanced Accuracy, ROC-AUC, F1-Macro, F1-Weighted),
genera explicabilidad SHAP y exporta el artefacto del modelo campeón (model_abcd.pkl).
"""

import argparse
import os
import time
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold
from lightgbm import LGBMClassifier
from xgboost import XGBClassifier
from catboost import CatBoostClassifier
import shap

try:
    from ml.pipeline import ejecutar_pipeline_completo
except ImportError:
    from pipeline import ejecutar_pipeline_completo

SEMILLA_ALEATORIA = 42
DEFAULT_OUTPUT_MODEL = os.path.join(os.path.dirname(__file__), "model_abcd.pkl")


def entrenar_y_evaluar_modelo(
    nombre_del_modelo: str,
    estimador_modelo: Any,
    matriz_X: pd.DataFrame,
    vector_y: pd.Series,
    numero_de_folds: int = 5,
    requiere_imputacion: bool = False,
    tamano_muestra_evaluacion: Optional[int] = 50000,
) -> Dict[str, Any]:
    """
    Función modular y genérica para entrenar y evaluar cualquier estimador multiclase
    con validación cruzada estratificada (Stratified K-Fold).
    """
    print(f"\n{'='*75}")
    print(f"Entrenando y evaluando: {nombre_del_modelo}")
    print(f"{'='*75}")

    if tamano_muestra_evaluacion is not None and len(matriz_X) > tamano_muestra_evaluacion:
        print(f"• Utilizando submuestra estratificada de {tamano_muestra_evaluacion:,} registros...")
        indice_muestra = vector_y.groupby(vector_y, group_keys=False).apply(
            lambda s: s.sample(
                int(np.rint(tamano_muestra_evaluacion * len(s) / len(vector_y))),
                random_state=SEMILLA_ALEATORIA,
            )
        ).index
        X_trabajo = matriz_X.loc[indice_muestra].reset_index(drop=True)
        y_trabajo = vector_y.loc[indice_muestra].reset_index(drop=True)
    else:
        X_trabajo = matriz_X.reset_index(drop=True)
        y_trabajo = vector_y.reset_index(drop=True)

    cv = StratifiedKFold(n_splits=numero_de_folds, shuffle=True, random_state=SEMILLA_ALEATORIA)

    lista_acc = []
    lista_b_acc = []
    lista_f1_macro = []
    lista_f1_weighted = []
    lista_auc = []

    ultimo_modelo = None
    ultimo_imputador = None
    t_inicio_total = time.time()

    for fold_num, (train_idx, val_idx) in enumerate(cv.split(X_trabajo, y_trabajo), 1):
        X_tr = X_trabajo.iloc[train_idx].copy()
        y_tr = y_trabajo.iloc[train_idx].copy()
        X_va = X_trabajo.iloc[val_idx].copy()
        y_va = y_trabajo.iloc[val_idx].copy()

        if requiere_imputacion:
            imputador = SimpleImputer(strategy="median")
            X_tr = pd.DataFrame(imputador.fit_transform(X_tr), columns=X_tr.columns)
            X_va = pd.DataFrame(imputador.transform(X_va), columns=X_va.columns)
            ultimo_imputador = imputador

        t_fold = time.time()
        estimador_modelo.fit(X_tr, y_tr)
        duracion_fold = time.time() - t_fold

        pred_clase = estimador_modelo.predict(X_va)
        if hasattr(pred_clase, "ndim") and pred_clase.ndim > 1:
            pred_clase = pred_clase.ravel()

        prob_predicha = estimador_modelo.predict_proba(X_va)

        acc = accuracy_score(y_va, pred_clase)
        b_acc = balanced_accuracy_score(y_va, pred_clase)
        f1_m = f1_score(y_va, pred_clase, average="macro", zero_division=0)
        f1_w = f1_score(y_va, pred_clase, average="weighted", zero_division=0)

        try:
            auc = roc_auc_score(y_va, prob_predicha, multi_class="ovr", average="weighted")
        except Exception:
            auc = np.nan

        lista_acc.append(acc)
        lista_b_acc.append(b_acc)
        lista_f1_macro.append(f1_m)
        lista_f1_weighted.append(f1_w)
        lista_auc.append(auc)

        print(
            f"  [Fold {fold_num}/{numero_de_folds}] {duracion_fold:.1f}s | "
            f"Acc: {acc:.4f} | Balanced Acc: {b_acc:.4f} | F1 Macro: {f1_m:.4f} | ROC-AUC: {auc:.4f}"
        )
        ultimo_modelo = estimador_modelo

    duracion_total = time.time() - t_inicio_total

    return {
        "nombre_modelo": nombre_del_modelo,
        "accuracy_promedio": float(np.nanmean(lista_acc)),
        "balanced_accuracy_promedio": float(np.nanmean(lista_b_acc)),
        "f1_macro_promedio": float(np.nanmean(lista_f1_macro)),
        "f1_weighted_promedio": float(np.nanmean(lista_f1_weighted)),
        "roc_auc_promedio": float(np.nanmean(lista_auc)),
        "tiempo_total_segundos": duracion_total,
        "modelo_entrenado": ultimo_modelo,
        "imputador_asociado": ultimo_imputador,
        "X_muestra_validacion": X_va,
        "y_muestra_validacion": y_va,
    }


def ejecutar_entrenamiento_comparativo(
    tamano_muestra: Optional[int] = 50000,
    numero_folds: int = 5,
    ruta_salida_modelo: str = DEFAULT_OUTPUT_MODEL,
    modelo_especifico: Optional[str] = None
):
    """Orquesta la preparación de datos, entrenamiento de los 4 modelos y guardado."""
    print("Iniciando pipeline de entrenamiento comparativo...")
    X, y, mapping = ejecutar_pipeline_completo()

    modelos_a_entrenar = {}

    # 1. LightGBM
    modelos_a_entrenar["LightGBM"] = {
        "estimador": LGBMClassifier(
            objective="multiclass",
            num_class=6,
            learning_rate=0.03,
            n_estimators=150,
            max_depth=6,
            num_leaves=31,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=SEMILLA_ALEATORIA,
            n_jobs=-1,
            verbose=-1,
        ),
        "requiere_imputacion": False,
    }

    # 2. XGBoost
    modelos_a_entrenar["XGBoost"] = {
        "estimador": XGBClassifier(
            objective="multi:softprob",
            num_class=6,
            learning_rate=0.03,
            n_estimators=150,
            max_depth=5,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=SEMILLA_ALEATORIA,
            n_jobs=-1,
            verbosity=0,
        ),
        "requiere_imputacion": False,
    }

    # 3. CatBoost
    modelos_a_entrenar["CatBoost"] = {
        "estimador": CatBoostClassifier(
            loss_function="MultiClass",
            learning_rate=0.05,
            iterations=150,
            depth=5,
            random_seed=SEMILLA_ALEATORIA,
            verbose=0,
            thread_count=-1,
        ),
        "requiere_imputacion": False,
    }

    # 4. Random Forest
    modelos_a_entrenar["Random Forest"] = {
        "estimador": RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=SEMILLA_ALEATORIA,
            n_jobs=-1,
        ),
        "requiere_imputacion": True,
    }

    if modelo_especifico and modelo_especifico in modelos_a_entrenar:
        modelos_a_entrenar = {modelo_especifico: modelos_a_entrenar[modelo_especifico]}

    resultados = []
    for nombre, cfg in modelos_a_entrenar.items():
        res = entrenar_y_evaluar_modelo(
            nombre_del_modelo=nombre,
            estimador_modelo=cfg["estimador"],
            matriz_X=X,
            vector_y=y,
            numero_de_folds=numero_folds,
            requiere_imputacion=cfg["requiere_imputacion"],
            tamano_muestra_evaluacion=tamano_muestra,
        )
        resultados.append(res)

    # Cuadro comparativo
    tabla = pd.DataFrame([
        {
            "Modelo": r["nombre_modelo"],
            "Balanced Accuracy": f"{r['balanced_accuracy_promedio']:.4f}",
            "ROC-AUC (OVR)": f"{r['roc_auc_promedio']:.4f}",
            "F1 Macro": f"{r['f1_macro_promedio']:.4f}",
            "F1 Weighted": f"{r['f1_weighted_promedio']:.4f}",
            "Tiempo (s)": f"{r['tiempo_total_segundos']:.1f}",
        }
        for r in resultados
    ])

    print("\n" + "=" * 80)
    print("RESUMEN COMPARATIVO DE MODELOS MULTICLASE (SUPERINTENDENCIA SSF)")
    print("=" * 80)
    print(tabla.to_string(index=False))

    # Selección del mejor modelo
    campeon = max(resultados, key=lambda r: r["roc_auc_promedio"])
    print(f"\n[OK] Modelo Campeón: {campeon['nombre_modelo']} con ROC-AUC = {campeon['roc_auc_promedio']:.4f}")

    # Explicabilidad SHAP y exportación
    print("Extrayendo importancia global de variables con SHAP...")
    X_shap = campeon["X_muestra_validacion"].iloc[:250]
    tabla_factores = []

    try:
        explicador = shap.TreeExplainer(campeon["modelo_entrenado"])
        vals_shap = explicador.shap_values(X_shap)
        if isinstance(vals_shap, np.ndarray) and vals_shap.ndim == 3:
            imp_medias = np.abs(vals_shap).mean(axis=(0, 2))
        elif isinstance(vals_shap, list):
            imp_medias = np.array([np.abs(sv).mean(axis=0) for sv in vals_shap]).mean(axis=0)
        else:
            imp_medias = np.abs(vals_shap).mean(axis=0)

        imp_pct = (imp_medias / (imp_medias.sum() + 1e-9)) * 100
        df_imp = pd.DataFrame({
            "variable": X_shap.columns,
            "importancia_pct": imp_pct
        }).sort_values(by="importancia_pct", ascending=False).reset_index(drop=True)
        tabla_factores = df_imp.head(20).to_dict(orient="records")
    except Exception as e:
        print(f"Nota en cálculo SHAP: {e}")

    # Guardado
    artefacto = {
        "modelo": campeon["modelo_entrenado"],
        "nombre_modelo": campeon["nombre_modelo"],
        "columnas_caracteristicas": X.columns.tolist(),
        "diccionario_clases": mapping,
        "tabla_factores_globales": tabla_factores,
        "imputador": campeon["imputador_asociado"],
    }
    joblib.dump(artefacto, ruta_salida_modelo)
    print(f"[OK] Artefacto guardado exitosamente en: {ruta_salida_modelo}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entrenador de Modelos de Riesgo Preventivo Banco Agrícola")
    parser.add_argument("--sample-size", type=int, default=50000, help="Tamaño de submuestra (default: 50,000)")
    parser.add_argument("--folds", type=int, default=5, help="Número de folds para StratifiedKFold (default: 5)")
    parser.add_argument("--model", type=str, default=None, choices=["LightGBM", "XGBoost", "CatBoost", "Random Forest"], help="Entrenar solo un modelo específico")
    parser.add_argument("--output", type=str, default=DEFAULT_OUTPUT_MODEL, help="Ruta del archivo de salida .pkl")

    args = parser.parse_args()
    ejecutar_entrenamiento_comparativo(
        tamano_muestra=args.sample_size,
        numero_folds=args.folds,
        ruta_salida_modelo=args.output,
        modelo_especifico=args.model
    )
