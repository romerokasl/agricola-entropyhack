---
name: health-checks
description: >-
  Protocolos de monitoreo, endpoints de diagnóstico (/api/health, /health en Python)
  y validación de conectividad con dependencias (Supabase, ML Inference Service).
---

# System Health Checks & Observability Guidelines

Esta habilidad describe cómo implementar y validar la disponibilidad de todos los servicios del sistema (Frontend, Backend, Base de Datos y Machine Learning).

---

## 1. Arquitectura de Health Checks

El sistema cuenta con dos niveles de sondeo de salud:

```
                  ┌───────────────────────────────┐
                  │   GET /api/health (Next.js)   │
                  └───────────────┬───────────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
                 ▼                                 ▼
      ┌──────────────────────┐          ┌──────────────────────┐
      │  Supabase Ping Probe │          │  ML Service /health  │
      │  (DB latency & RLS)  │          │  (FastAPI + Model)   │
      └──────────────────────┘          └──────────────────────┘
```

---

## 2. Especificación del Endpoint `/api/health`

### Formato de Respuesta
```json
{
  "status": "healthy", // "healthy" | "degraded" | "unhealthy"
  "timestamp": "2026-09-06T12:00:00.000Z",
  "version": "0.1.0",
  "uptimeSeconds": 1420,
  "services": {
    "nextjs": {
      "status": "up",
      "latencyMs": 2
    },
    "supabase": {
      "status": "up", // "up" | "down" | "not_configured"
      "latencyMs": 45,
      "message": "Connected to PostgreSQL"
    },
    "ml_service": {
      "status": "up", // "up" | "degraded" | "fallback_active"
      "latencyMs": 12,
      "modelLoaded": true,
      "message": "FastAPI LightGBM/XGBoost inference ready"
    }
  }
}
```

### Criterios de Estado
* **healthy**: Todos los servicios operativos con latencias normales.
* **degraded**: El servicio de ML está usando el modo fallback local porque el microservicio Python está iniciando o no configurado en entorno local. La aplicación sigue funcionando para el usuario final.
* **unhealthy**: La base de datos o el runtime de Next.js tienen fallos críticos no recuperables.

---

## 3. Especificación del Endpoint `/health` en FastAPI (`/ml/api.py`)

* Endpoint: `GET http://localhost:8000/health`
* Respuesta:
  ```json
  {
    "status": "ok",
    "model_loaded": true,
    "model_type": "LightGBM / XGBoost",
    "model_version": "1.0.0",
    "supported_features_count": 14
  }
  ```

---

## 4. Verificación Rápida en Terminal

Para verificar el estado completo del stack desde la terminal:

```bash
# Probar API Next.js
curl -s http://localhost:3000/api/health

# Probar API ML en Python
curl -s http://localhost:8000/health
```
