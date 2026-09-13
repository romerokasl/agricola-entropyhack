"""
Suite de Pruebas de Verificación para el Microservicio ML y MLOps de Banco Agrícola.
Ejecuta validaciones automáticas sobre todos los endpoints y capacidades de monitoreo.
"""

import sys
from fastapi.testclient import TestClient

try:
    from ml.api import app, load_model_and_artifacts
except ImportError:
    from api import app, load_model_and_artifacts


def ejecutar_pruebas():
    print("=" * 70)
    print("INICIANDO SUITE DE PRUEBAS DEL SERVICIO ML & MLOPS")
    print("=" * 70)

    # 1. Cargar artefactos
    load_model_and_artifacts()
    client = TestClient(app)

    # 2. Test /health
    print("\n1. Probando GET /health...")
    res_health = client.get("/health")
    assert res_health.status_code == 200, f"Error en /health: {res_health.status_code}"
    data_health = res_health.json()
    assert data_health["status"] == "ok", "El estado no es 'ok'"
    assert data_health["model_loaded"] is True, "El modelo no fue cargado"
    print(f"   [OK] Servicio: {data_health['service']} | Modelo: {data_health['model_type']} (Status 200)")

    # 3. Test /predict (Cliente con bajo riesgo)
    print("\n2. Probando POST /predict (Perfil Bajo Riesgo)...")
    payload_bajo_riesgo = {
        "customerId": "CUST_LOW_001",
        "monthlyIncome": 1200.0,
        "debtToIncomeRatio": 0.25,
        "creditLineUtilization": 0.35,
        "savingsDropPct": 0.05,
        "latePaymentsLast6m": 0,
        "daysUntilNextPayment": 20
    }
    res_low = client.post("/predict", json=payload_bajo_riesgo)
    assert res_low.status_code == 200, f"Error en /predict: {res_low.status_code}"
    data_low = res_low.json()
    assert data_low["success"] is True
    print(f"   [OK] Score: {data_low['data']['riskScore']} | Nivel: {data_low['data']['riskLevel']} | Latencia: {data_low['meta']['latencyMs']} ms")
    print(f"   [OK] Mensaje empático: \"{data_low['data']['empatheticMessage'][:75]}...\"")

    # 4. Test /predict (Cliente con estrés financiero alto)
    print("\n3. Probando POST /predict (Perfil Alto Riesgo / Alerta)...")
    payload_alto_riesgo = {
        "customerId": "CUST_HIGH_002",
        "monthlyIncome": 600.0,
        "debtToIncomeRatio": 0.75,
        "creditLineUtilization": 0.92,
        "savingsDropPct": 0.45,
        "latePaymentsLast6m": 2,
        "daysUntilNextPayment": 5,
        "recentPaymentDifference": -250.0
    }
    res_high = client.post("/predict", json=payload_alto_riesgo)
    assert res_high.status_code == 200, f"Error en /predict: {res_high.status_code}"
    data_high = res_high.json()
    assert data_high["success"] is True
    assert len(data_high["data"]["topRiskFactors"]) > 0, "No generó factores de riesgo"
    print(f"   [OK] Score: {data_high['data']['riskScore']} | Nivel: {data_high['data']['riskLevel']} | Clase SSF: {data_high['data']['predictedArrearsClass']}")
    print(f"   [OK] Factores identificados: {len(data_high['data']['topRiskFactors'])} factores de riesgo")

    # 5. Test /metrics
    print("\n4. Probando GET /metrics...")
    res_metrics = client.get("/metrics")
    assert res_metrics.status_code == 200
    data_metrics = res_metrics.json()
    telemetry = data_metrics["service_telemetry"]
    print(f"   [OK] P50: {telemetry['latency_ms']['p50']} ms | P95: {telemetry['latency_ms']['p95']} ms | Requests: {telemetry['total_requests']}")

    # 6. Test /drift/simulate (Escenario de estrés económico)
    print("\n5. Probando POST /drift/simulate (Escenario: economic_stress)...")
    res_sim = client.post("/drift/simulate", json={"count": 40, "scenario": "economic_stress"})
    assert res_sim.status_code == 200
    sim_result = res_sim.json()["simulation_result"]
    print(f"   [OK] Tráfico inyectado: {sim_result['simulated_count']} solicitudes | Estado: {sim_result['drift_summary']['status']}")

    # 7. Test /drift
    print("\n6. Probando GET /drift...")
    res_drift = client.get("/drift")
    assert res_drift.status_code == 200
    drift_report = res_drift.json()["drift_report"]
    print(f"   [OK] Estatus Global: {drift_report['status']} | Máximo PSI: {drift_report['highest_psi']}")
    print(f"   [OK] Variables con deriva: {drift_report['drifted_features_count']}")
    print(f"   [OK] Recomendación: \"{drift_report['recommendation']}\"")

    print("\n" + "=" * 70)
    print("[EXITO TOTAL] TODAS LAS 6 PRUEBAS PASARON SATISFACTORIAMENTE")
    print("=" * 70)


if __name__ == "__main__":
    try:
        ejecutar_pruebas()
    except AssertionError as err:
        print(f"\n[FALLO EN PRUEBA]: {err}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR INESPERADO]: {e}")
        sys.exit(1)
