"""
Módulo de Observabilidad, Métricas de Inferencia y Detección de Data Drift
para el Sistema de Alerta Temprana de Banco Agrícola.

Implementa:
- Telemetría en tiempo real: Latencias (P50, P95, P99), throughput y códigos HTTP.
- Detección de Data Drift: Population Stability Index (PSI) con proporciones empíricas y KS-test.
- Detección de Prediction Drift: Desviación en la distribución de las 6 clases SSF.
- Simulación de escenarios de estrés macroeconómico para demostraciones en vivo.
"""

import collections
import json
import os
import time
from typing import Dict, List, Optional, Any
import numpy as np
from scipy import stats

BASELINE_FILE = os.path.join(os.path.dirname(__file__), "baseline_stats.json")


class ModelMonitor:
    def __init__(self, baseline_path: str = BASELINE_FILE, window_size: int = 1000):
        self.window_size = window_size
        self.start_time = time.time()
        self.total_requests = 0
        self.error_count = 0
        self.model_requests = 0
        self.fallback_requests = 0

        # Buffers circulares en memoria para estadísticas rodantes
        self.latencies_ms = collections.deque(maxlen=window_size)
        self.risk_scores = collections.deque(maxlen=window_size)
        self.predicted_classes = collections.deque(maxlen=window_size)
        self.feature_records = collections.deque(maxlen=window_size)

        # Cargar perfil de referencia (Baseline)
        self.baseline = self._load_baseline(baseline_path)
        print(f"[ModelMonitor] Inicializado con ventana rodante de {window_size} muestras.")

    def _load_baseline(self, path: str) -> Dict[str, Any]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    print(f"[ModelMonitor] Perfil baseline cargado exitosamente desde {path}")
                    return data
            except Exception as e:
                print(f"[ModelMonitor] Error cargando baseline: {e}")
        return {
            "distribucion_clases_esperada": {
                "Healthy": 0.4698,
                "A1": 0.3533,
                "A2": 0.1111,
                "B": 0.0338,
                "C": 0.0080,
                "D_E": 0.0240
            },
            "variables_monitoreadas": {},
            "muestra_referencia_normal": []
        }

    def record_inference(
        self,
        latency_ms: float,
        predicted_class: str,
        risk_score: int,
        feature_dict: Dict[str, float],
        used_model: bool = True
    ):
        """Registra una predicción en el buffer en O(1) tiempo."""
        self.total_requests += 1
        if used_model:
            self.model_requests += 1
        else:
            self.fallback_requests += 1

        self.latencies_ms.append(latency_ms)
        self.predicted_classes.append(predicted_class)
        self.risk_scores.append(risk_score)
        self.feature_records.append(feature_dict)

    def record_error(self):
        self.total_requests += 1
        self.error_count += 1

    # --------------------------------------------------------------------------
    # 1. MÉTRICAS DE SALUD DEL SERVICIO E INFERENCIA
    # --------------------------------------------------------------------------
    def get_service_metrics(self) -> Dict[str, Any]:
        """Calcula percentiles de latencia, throughput y uso del modelo."""
        latencies = list(self.latencies_ms)
        uptime = time.time() - self.start_time

        if latencies:
            p50 = float(np.percentile(latencies, 50))
            p95 = float(np.percentile(latencies, 95))
            p99 = float(np.percentile(latencies, 99))
            avg_lat = float(np.mean(latencies))
            min_lat = float(np.min(latencies))
            max_lat = float(np.max(latencies))
        else:
            p50 = p95 = p99 = avg_lat = min_lat = max_lat = 0.0

        return {
            "uptime_seconds": round(uptime, 1),
            "total_requests": self.total_requests,
            "requests_per_minute": round((self.total_requests / max(1, uptime)) * 60, 2),
            "error_rate_pct": round((self.error_count / max(1, self.total_requests)) * 100, 2),
            "model_usage_pct": round((self.model_requests / max(1, self.total_requests)) * 100, 2),
            "fallback_usage_pct": round((self.fallback_requests / max(1, self.total_requests)) * 100, 2),
            "latency_ms": {
                "p50": round(p50, 2),
                "p95": round(p95, 2),
                "p99": round(p99, 2),
                "mean": round(avg_lat, 2),
                "min": round(min_lat, 2),
                "max": round(max_lat, 2)
            }
        }

    # --------------------------------------------------------------------------
    # 2. MÉTRICAS DE SALUD DE PREDICCIÓN (PREDICTION / CONCEPT DRIFT)
    # --------------------------------------------------------------------------
    def get_prediction_health(self) -> Dict[str, Any]:
        """Compara la distribución de clases en producción contra el baseline SSF."""
        total_observed = len(self.predicted_classes)
        expected = self.baseline.get("distribucion_clases_esperada", {})
        
        if total_observed == 0:
            return {
                "total_observations": 0,
                "status": "INSUFFICIENT_DATA",
                "observed_distribution": {},
                "expected_distribution": expected,
                "risk_score_summary": {"mean": 0, "p50": 0, "p90": 0}
            }

        counts = collections.Counter(self.predicted_classes)
        observed_dist = {cls: round(counts.get(cls, 0) / total_observed, 4) for cls in expected}

        # Cálculo de distancia de variación total (Total Variation Distance)
        tvd = 0.5 * sum(abs(observed_dist.get(c, 0) - expected.get(c, 0)) for c in expected)

        scores = list(self.risk_scores)
        score_summary = {
            "mean": round(float(np.mean(scores)), 1) if scores else 0,
            "median": round(float(np.median(scores)), 1) if scores else 0,
            "p90": round(float(np.percentile(scores, 90)), 1) if scores else 0,
            "high_risk_ratio_pct": round(
                (sum(1 for s in scores if s >= 55) / max(1, len(scores))) * 100, 1
            )
        }

        # Estado del prediction drift
        if tvd < 0.10:
            pred_status = "STABLE"
        elif tvd < 0.25:
            pred_status = "MODERATE_SHIFT"
        else:
            pred_status = "SIGNIFICANT_DRIFT"

        return {
            "total_observations": total_observed,
            "prediction_drift_status": pred_status,
            "total_variation_distance": round(tvd, 4),
            "observed_distribution": observed_dist,
            "expected_distribution": expected,
            "risk_score_summary": score_summary
        }

    # --------------------------------------------------------------------------
    # 3. ALGORITMOS DE DETECCIÓN DE DATA DRIFT (PSI EMPÍRICO & KS-TEST)
    # --------------------------------------------------------------------------
    @staticmethod
    def calculate_psi(
        interior_cuts: List[float],
        expected_proportions: List[float],
        observed_values: List[float]
    ) -> float:
        """
        Calcula el Population Stability Index (PSI) de grado bancario.
        Utiliza los cortes interiores para abarcar desde -inf a +inf
        comparando contra las proporciones empíricas del baseline.
        
        Criterios estándar bancarios:
        - PSI < 0.10: Población estable (Semáforo Verde).
        - 0.10 <= PSI < 0.20: Alerta preventiva / Deriva moderada (Semáforo Amarillo).
        - PSI >= 0.20: Deriva significativa (Semáforo Rojo / Re-entrenamiento).
        """
        if not observed_values or len(interior_cuts) == 0:
            return 0.0

        bin_indices = np.digitize(observed_values, interior_cuts)
        n_bins = len(interior_cuts) + 1
        observed_counts = np.bincount(bin_indices, minlength=n_bins)

        # Suavizado de Laplace
        observed_prop = (observed_counts + 1e-4) / (len(observed_values) + 1e-4 * n_bins)
        exp_prop = np.array(expected_proportions)
        if len(exp_prop) != n_bins:
            exp_prop = np.ones(n_bins) / n_bins

        psi = np.sum((observed_prop - exp_prop) * np.log(observed_prop / exp_prop))
        return float(round(max(0.0, psi), 4))

    def get_data_drift_report(self) -> Dict[str, Any]:
        """
        Evalúa el Data Drift para todas las variables clave monitoreadas
        usando las proporciones del baseline de entrenamiento.
        """
        monitored_vars = self.baseline.get("variables_monitoreadas", {})
        total_records = len(self.feature_records)

        if total_records < 10 or not monitored_vars:
            return {
                "status": "INSUFFICIENT_DATA",
                "total_observations": total_records,
                "message": "Se requieren al menos 10 inferencias para computar métricas de drift fiables.",
                "variables_drift": {}
            }

        records_dict = {}
        for record in self.feature_records:
            for k, v in record.items():
                if k not in records_dict:
                    records_dict[k] = []
                records_dict[k].append(v)

        variables_report = {}
        highest_psi = 0.0
        drifted_features_count = 0

        for var_name, baseline_info in monitored_vars.items():
            if var_name not in records_dict:
                continue

            current_values = [v for v in records_dict[var_name] if v is not None and not np.isnan(v)]
            if len(current_values) < 5:
                continue

            cuts = baseline_info.get("interior_cuts", [])
            expected_p = baseline_info.get("expected_proportions", [])
            psi = self.calculate_psi(cuts, expected_p, current_values)
            highest_psi = max(highest_psi, psi)

            # Prueba Kolmogorov-Smirnov
            base_mean = baseline_info.get("mean", 0.0)
            base_std = max(1e-4, baseline_info.get("std", 1.0))
            ks_stat, ks_pvalue = stats.kstest(
                current_values,
                "norm",
                args=(base_mean, base_std)
            )

            if psi < 0.10:
                var_status = "NORMAL"
            elif psi < 0.20:
                var_status = "WARNING"
                drifted_features_count += 1
            else:
                var_status = "CRITICAL_DRIFT"
                drifted_features_count += 1

            current_mean = float(np.mean(current_values))
            shift_pct = round(((current_mean - base_mean) / (abs(base_mean) + 1e-5)) * 100, 2)

            variables_report[var_name] = {
                "psi": psi,
                "status": var_status,
                "ks_pvalue": round(float(ks_pvalue), 4),
                "baseline_mean": round(base_mean, 2),
                "current_mean": round(current_mean, 2),
                "mean_shift_pct": shift_pct
            }

        # Semáforo global del sistema
        if highest_psi >= 0.20 or drifted_features_count >= 2:
            global_status = "CRITICAL"
            recommendation = "Se detectó deriva severa de datos. Se sugiere recalibrar el modelo con datos recientes de cartera."
        elif highest_psi >= 0.10 or drifted_features_count >= 1:
            global_status = "WARNING"
            recommendation = "Deriva moderada detectada en variables clave. Monitorear de cerca en los próximos cortes."
        else:
            global_status = "HEALTHY"
            recommendation = "Las distribuciones de entrada se mantienen consistentes con el baseline de entrenamiento."

        return {
            "status": global_status,
            "highest_psi": round(highest_psi, 4),
            "drifted_features_count": drifted_features_count,
            "total_observations": total_records,
            "recommendation": recommendation,
            "variables_drift": variables_report
        }

    # --------------------------------------------------------------------------
    # 4. SIMULADOR DE ESCENARIOS DE ESTRÉS (PARA PITCH & TESTING)
    # --------------------------------------------------------------------------
    def simulate_traffic(self, count: int = 50, scenario: str = "normal") -> Dict[str, Any]:
        """
        Simula un lote de inferencias para validar el comportamiento del monitor.
        scenarios: 'normal', 'economic_stress' (induce drift), 'mild_warning'.
        """
        classes = ["Healthy", "A1", "A2", "B", "C", "D_E"]
        np.random.seed(int(time.time()) % 100000)

        muestras_normales = self.baseline.get("muestra_referencia_normal", [])

        for i in range(count):
            lat = float(np.random.gamma(shape=2.0, scale=3.5) + 4.0)  # ~11 ms

            if scenario == "economic_stress":
                features = {
                    "installment_payment_ratio": float(np.random.uniform(-18000, -3000)),
                    "debt_to_income_ratio": float(np.random.uniform(9.0, 18.0)),
                    "credit_annuity_ratio": float(np.random.uniform(30, 60)),
                    "AMT_INCOME_TOTAL": float(np.random.uniform(50000, 100000)),
                    "AMT_CREDIT": float(np.random.uniform(1200000, 3000000)),
                    "AMT_ANNUITY": float(np.random.uniform(60000, 120000)),
                    "age_in_years": int(np.random.randint(20, 35)),
                    "delay_days_clean_max_90dias": float(np.random.uniform(45, 120)),
                    "EXT_SOURCE_2": float(np.random.uniform(0.05, 0.25)),
                    "EXT_SOURCE_3": float(np.random.uniform(0.05, 0.25))
                }
                score = int(np.random.randint(70, 96))
                cls = np.random.choice(["A2", "B", "C", "D_E"], p=[0.30, 0.40, 0.15, 0.15])

            elif scenario == "mild_warning":
                features = {
                    "installment_payment_ratio": float(np.random.uniform(-4000, -800)),
                    "debt_to_income_ratio": float(np.random.uniform(5.5, 7.5)),
                    "credit_annuity_ratio": float(np.random.uniform(22, 35)),
                    "AMT_INCOME_TOTAL": float(np.random.normal(150000, 30000)),
                    "AMT_CREDIT": float(np.random.normal(750000, 150000)),
                    "AMT_ANNUITY": float(np.random.normal(32000, 6000)),
                    "age_in_years": int(np.random.randint(25, 55)),
                    "delay_days_clean_max_90dias": float(np.random.uniform(15, 30)),
                    "EXT_SOURCE_2": float(np.random.uniform(0.35, 0.55)),
                    "EXT_SOURCE_3": float(np.random.uniform(0.35, 0.55))
                }
                score = int(np.random.randint(45, 70))
                cls = np.random.choice(classes, p=[0.25, 0.35, 0.25, 0.10, 0.03, 0.02])

            else:  # normal: muestra directa de la distribución empírica
                if muestras_normales:
                    idx = (i + int(time.time())) % len(muestras_normales)
                    features = dict(muestras_normales[idx])
                else:
                    features = {
                        "installment_payment_ratio": 0.0,
                        "debt_to_income_ratio": 3.97,
                        "credit_annuity_ratio": 21.6,
                        "AMT_INCOME_TOTAL": 168000.0,
                        "AMT_CREDIT": 600000.0,
                        "AMT_ANNUITY": 27000.0,
                        "age_in_years": 43,
                        "delay_days_clean_max_90dias": 0.0,
                        "EXT_SOURCE_2": 0.51,
                        "EXT_SOURCE_3": 0.51
                    }
                score = int(np.random.randint(15, 45))
                cls = np.random.choice(classes, p=[0.47, 0.35, 0.11, 0.04, 0.01, 0.02])

            self.record_inference(
                latency_ms=lat,
                predicted_class=cls,
                risk_score=score,
                feature_dict=features,
                used_model=True
            )

        return {
            "simulated_count": count,
            "scenario": scenario,
            "current_buffer_size": len(self.latencies_ms),
            "metrics": self.get_service_metrics(),
            "drift_summary": self.get_data_drift_report()
        }


# Instancia singleton para compartir en el microservicio
monitor_singleton = ModelMonitor()
