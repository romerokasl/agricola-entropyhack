# Módulo de Machine Learning — Bancoagrícola EntropyHack

Este módulo contiene el pipeline para detección temprana y preventiva de morosidad crediticia (15 a 45 días antes del vencimiento) y la generación de recomendaciones empáticas.

---

## 1. Instalación de Dependencias

```bash
# Crear entorno virtual en Python
python -m venv venv

# En Windows:
venv\Scripts\activate
# En Linux/Mac:
source venv/bin/activate

# Instalar requerimientos
pip install -r requirements.txt
```

---

## 2. Generación de Datos Sintéticos

Si no se cuenta con el dataset final aún, genera 100,000 registros sintéticos realistas con:

```bash
python synthetic_data.py --rows 100000 --output synthetic_credit_data.csv
```

---

## 3. Entrenamiento del Modelo

El script entrena con **LightGBM** o **XGBoost** (y cuenta con fallback nativo en Scikit-Learn `HistGradientBoostingClassifier`).

```bash
# Entrenar con dataset generado o sintético automático
python train.py --rows 100000
```

Salida generada:
* `model.joblib`: Artefacto binario del modelo optimizado (< 4 MB).
* `model_meta.json`: Métricas de evaluación (ROC-AUC, Brier score) y metadatos de explicabilidad.

---

## 4. Iniciar Microservicio de Inferencia (FastAPI)

```bash
uvicorn api:app --reload --port 8000
```

* **Documentación interactiva (Swagger UI)**: `http://localhost:8000/docs`
* **Health Check**: `GET http://localhost:8000/health`
* **Inferencia**: `POST http://localhost:8000/predict`
