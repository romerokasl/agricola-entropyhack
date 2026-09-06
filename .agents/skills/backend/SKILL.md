---
name: backend
description: >-
  Estándares de backend, diseño de APIs en Next.js App Router, integración con Supabase
  y comunicación con el servicio de inferencia de Machine Learning.
---

# Backend Engineering Guidelines

Esta habilidad define la arquitectura, convenciones y buenas prácticas del backend para el proyecto de prevención de mora crediticia.

---

## 1. Stack y Arquitectura Backend

* **Next.js App Router (`/app/api/.../route.ts`)**: Funciona como Backend-for-Frontend (BFF). Maneja autenticación de sesiones, orquestación de llamadas a Supabase y proxy hacia el servicio de ML.
* **Supabase (PostgreSQL)**: Base de datos relacional, Auth y Row-Level Security (RLS).
* **Python FastAPI (`/ml/api.py`)**: Microservicio de inferencia de Machine Learning para cálculo de score de pre-mora y explicabilidad SHAP.

---

## 2. Convenciones para Next.js Route Handlers

### Estructura de Respuesta Estándar
Toda respuesta de la API debe seguir este formato JSON consistente:

```typescript
// Éxito
{
  "success": true,
  "data": { ... },
  "meta": { "timestamp": "2026-09-06T12:00:00Z" }
}

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mensaje legible para el usuario o log",
    "details": [ ... ]
  }
}
```

### Reglas Críticas
1. **Validación con Zod**: Todo payload entrante (`req.json()`) debe validarse estrictamente con esquemas de Zod antes de procesarlo.
2. **Uso de Clientes de Supabase**:
   * Para operaciones del cliente o usuario autenticado: usar el cliente con `ANON_KEY` respetando RLS.
   * Para operaciones administrativas del servidor: usar `SUPABASE_SERVICE_ROLE_KEY` **únicamente** en Server Components o Route Handlers seguros. **NUNCA** exponer esta clave con prefijo `NEXT_PUBLIC_`.
3. **Manejo de Errores**: Nunca dejar que una promesa no capturada devuelva un `500 Internal Server Error` sin formato. Encapsular en bloques `try/catch` y devolver códigos HTTP semánticos (400, 401, 403, 404, 422, 503).
4. **Fallback Inteligente para ML**: Al invocar el endpoint `/api/predict`, si el servicio externo de FastAPI en Python no está disponible (timeout o conexión rechazada), la API debe activar un fallback heurístico determinista para que la UI nunca quede bloqueada durante el hackathon.

---

## 3. Integración con Supabase

```typescript
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
```

---

## 4. Códigos de Estado HTTP
* `200 OK`: Consulta o actualización exitosa.
* `201 Created`: Recurso creado (ej. nueva evaluación de riesgo, acuerdo de pago registrado).
* `400 Bad Request`: Parámetros inválidos.
* `404 Not Found`: Cliente o producto de crédito no encontrado.
* `422 Unprocessable Entity`: Error de validación de negocio.
* `503 Service Unavailable`: Dependencia externa crítica fuera de línea (con detalle en salud del sistema).
