# Módulo de Machine Learning, Inferencia y MLOps — Banco Agrícola (EntropyHack)

Sistema integral de **Alerta Temprana de Morosidad Preventiva y Observabilidad MLOps** diseñado para detectar estrés financiero 15 a 45 días antes de la fecha de corte, protegiendo el récord crediticio del salvadoreño conforme a la normativa de la **Superintendencia del Sistema Financiero de El Salvador (NCB-022 / NASF-09)**.

---

## 1. Arquitectura Modular del Módulo `ml/`

El código se encuentra modularizado en scripts `.py` independientes para facilitar el desarrollo, mantenimiento, pruebas y ejecución en producción:

```
ml/
├── pipeline.py             # Ingesta, limpieza, ingeniería de ratios SSF y preparación de matrices X e y
├── train.py                # Entrenamiento y validación cruzada (5-fold) de 4 modelos + SHAP
├── generate_baseline.py    # Generación de perfil estadístico de referencia (deciles y proporciones empíricas)
├── monitoring.py           # Motor de observabilidad MLOps: PSI, KS-test, latencias P95 y prediction drift
├── api.py                  # Microservicio FastAPI ultrarrápido (Inferencia + Explicabilidad + MLOps)
├── test_service.py         # Suite de pruebas automatizadas end-to-end (Health, Predict, Metrics, Drift)
├── model.ipynb             # Notebook interactivo de exploración y prototipado rápido
├── baseline_stats.json     # Perfil estadístico de referencia del entrenamiento para cálculo de drift
├── model_abcd.pkl          # Artefacto serializado del modelo campeón (LightGBM multiclase SSF)
└── requirements.txt        # Dependencias de Python verificadas
```

---

## 2. Instalación y Requisitos Previos

Asegúrate de contar con Python 3.10+ e instala las dependencias:

```bash
# Crear y activar entorno virtual (opcional pero recomendado)
python -m venv venv

# En Windows:
venv\Scripts\activate
# En Linux / Mac:
source venv/bin/activate

# Instalar librerías
pip install -r ml/requirements.txt
```

---

## 3. Guía de Ejecución Paso a Paso

### Paso 1: Ejecutar el Pipeline de Datos y Limpieza
El script `ml/pipeline.py` descarga automáticamente el dataset de Kaggle (o lo lee del caché), aplica la limpieza justificada, construye el target multiclase SSF y los ratios financieros ganadores:

```bash
python ml/pipeline.py
```

### Paso 2: Entrenar y Comparar los 4 Modelos
El script `ml/train.py` entrena y compara **LightGBM**, **XGBoost**, **CatBoost** y **Random Forest** mediante `StratifiedKFold` (5 folds), genera los valores SHAP y guarda el mejor modelo en `ml/model_abcd.pkl`:

```bash
# Entrenar los 4 modelos con una submuestra ágil de 50k registros:
python ml/train.py --sample-size 50000 --folds 5

# O entrenar solo un modelo específico (ej. LightGBM):
python ml/train.py --model LightGBM --sample-size 50000
```

### Paso 3: Generar el Perfil de Referencia para Data Drift
Extrae los deciles empíricos y momentos de las variables clave para permitir el cálculo de PSI en O(1) tiempo durante la inferencia:

```bash
python ml/generate_baseline.py
```

### Paso 4: Iniciar el Microservicio FastAPI
Inicia el servidor de inferencia preventiva y telemetría:

```bash
python ml/api.py
# O usando uvicorn directamente:
uvicorn ml.api:app --host 0.0.0.0 --port 8000 --reload
```

* **Documentación interactiva Swagger UI:** `http://localhost:8000/docs`
* **Especificación OpenAPI en JSON:** `http://localhost:8000/openapi.json`

---

## 4. Cómo Probar el Servicio (Suite de Pruebas Automatizadas)

Para verificar que todos los componentes (modelo, telemetría, predicción y drift) funcionan al 100%, ejecuta:

```bash
python ml/test_service.py
```

Este script valida automáticamente:
1. `GET /health`: Conexión del servicio y modelo cargado.
2. `POST /predict`: Inferencia real con latencia $< 15 \text{ ms}$ y generación de mensaje empático.
3. `GET /metrics`: Recolección de percentiles P50, P95 y P99 en tiempo real.
4. `POST /drift/simulate`: Inyección de estrés macroeconómico sintético.
5. `GET /drift`: Activación del semáforo `CRITICAL` cuando el PSI supera el umbral bancario.

---

## 5. Catálogo de Endpoints de la API

### 1. Inferencia Preventiva (`POST /predict`)
Calcula el nivel de riesgo de mora y genera una recomendación empática personalizada.

* **Request:**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "CUST_12345",
    "monthlyIncome": 850.0,
    "debtToIncomeRatio": 0.42,
    "creditLineUtilization": 0.78,
    "savingsDropPct": 0.35,
    "latePaymentsLast6m": 1,
    "daysUntilNextPayment": 12
  }'
```

* **Response:**
```json
{
  "success": true,
  "data": {
    "customerId": "CUST_12345",
    "riskScore": 74,
    "riskLevel": "MODERATE_HIGH",
    "predictedArrearsClass": "A2",
    "defaultProbability": 0.74,
    "daysUntilNextPayment": 12,
    "preventiveActionRecommended": "PAYMENT_RESTRUCTURING",
    "topRiskFactors": [
      { "factor": "Utilización de línea de crédito alta (>78%)", "impact": "+27%" },
      { "factor": "Caída en saldo de ahorros en últimos 3 meses", "impact": "+14%" },
      { "factor": "Ratio deuda/ingreso superior al umbral óptimo", "impact": "+10%" },
      { "factor": "1 atraso(s) en cuotas recientes", "impact": "+15%" }
    ],
    "suggestedSolution": "División de cuota en dos pagos quincenales o reprogramación sin penalización.",
    "empatheticMessage": "Notamos que este mes tus gastos han aumentado. En Banco Agrícola somos tu aliado: te ofrecemos dividir tu cuota en dos partes o reprogramar la fecha sin intereses moratorios."
  },
  "meta": {
    "latencyMs": 7.3,
    "modelType": "LightGBM",
    "usedRealModel": true
  }
}
```

---

### 2. Sonda de Salud (`GET /health`)
Compatible con la especificación `.agents/skills/health-checks/`:

```bash
curl http://localhost:8000/health
```

---

### 3. Telemetría de Inferencia (`GET /metrics`)
Retorna latencias (P50, P95, P99), throughput y distribución observada de las 6 clases SSF:

```bash
curl http://localhost:8000/metrics
```

---

### 4. Detección de Data Drift (`GET /drift`)
Calcula el Population Stability Index (PSI) y KS-test comparando la ventana rodante contra el baseline:

```bash
curl http://localhost:8000/drift
```

* **Criterio Bancario de Semáforo:**
  * 🟢 **HEALTHY** ($\text{PSI} < 0.10$): Población crediticia estable.
  * 🟡 **WARNING** ($0.10 \le \text{PSI} < 0.20$): Alerta de deriva moderada.
  * 🔴 **CRITICAL** ($\text{PSI} \ge 0.20$): Deriva severa; gatilla recomendación de re-entrenamiento.

---

### 5. Simulación de Tráfico para Demo (`POST /drift/simulate`)
Ideal para el pitch ante el jurado: permite inyectar 50 solicitudes estresadas y ver en vivo cómo el semáforo cambia a `CRITICAL`:

```bash
curl -X POST http://localhost:8000/drift/simulate \
  -H "Content-Type: application/json" \
  -d '{"count": 50, "scenario": "economic_stress"}'
```
