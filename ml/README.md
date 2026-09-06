# Módulo de Inferencia y Monitoreo de ML — Bancoagrícola EntropyHack

Este módulo aloja el microservicio de inferencia de pre-mora crediticia en producción y la base para el monitoreo de data drift y métricas del modelo.

---

## 1. Arquitectura de Inferencia

* **Entrenamiento**: Se realiza externamente por el equipo de datos con el dataset oficial.
* **Artefactos del Modelo**:
  * `ml/model.joblib` (o `model.json`): Modelo pre-entrenado exportado.
  * `ml/model_meta.json`: Metadatos de variables esperadas y métricas baseline.
* **Microservicio**: FastAPI (`api.py`) con latencia ultrarrápida (< 2 ms) para consultas en tiempo real desde Next.js / Supabase.

---

## 2. Iniciar el Servicio Localmente

```bash
# Crear entorno virtual en Python
python -m venv venv

# En Windows:
venv\Scripts\activate
# En Linux/Mac:
source venv/bin/activate

# Instalar requerimientos
pip install -r requirements.txt

# Iniciar servidor FastAPI
uvicorn api:app --reload --port 8000
```

* **Swagger UI interactivo**: `http://localhost:8000/docs`
* **Health Check**: `GET http://localhost:8000/health`
* **Predicción de Riesgo**: `POST http://localhost:8000/predict`

---

## 3. Próximos Pasos (Monitoreo & Data Drift)

* Registro de distribuciones de variables de inferencia en tiempo real vs distribución de entrenamiento.
* Cálculo de métricas de desviación (Population Stability Index - PSI / Wasserstein distance).
* Detección de drift para alertar necesidad de re-entrenamiento del modelo.
