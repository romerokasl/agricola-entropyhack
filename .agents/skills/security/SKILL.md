---
name: security
description: >-
  Protocolos de seguridad bancaria, protección de datos sensibles (PII), políticas
  de Supabase Row-Level Security (RLS) y prevención de vulnerabilidades OWASP.
---

# Security & Fintech Data Protection Guidelines

Esta habilidad establece las directrices de seguridad indispensables para el desarrollo de la plataforma bancaria de prevención de mora.

---

## 1. Protección de Información Personal Identificable (PII)

El sector financiero exige protección rigurosa de la privacidad:

* **Enmascaramiento de Cuentas y Tarjetas**:
  * Nunca devolver ni registrar en logs números completos de tarjetas o cuentas bancarias.
  * Formato permitido: `•••• •••• •••• 1234` o `CUENTA-***-789`.
* **Sanitización de Logs**:
  * Prohibido hacer `console.log()` de payloads completos que contengan DUI, NIT, teléfonos, correos o números de cuenta.
  * Usar logs estructurados con identificadores anónimos (`customer_uuid`).
* **Datos Sintéticos en Desarrollo**:
  * Nunca usar datos reales de clientes de banco en pruebas locales o commits.
  * Usar siempre el script `/ml/synthetic_data.py` para generar datos simulados.

---

## 2. Row-Level Security (RLS) en Supabase

Toda tabla creada en PostgreSQL DEBE tener RLS activado por defecto:

```sql
-- Habilitar RLS en toda tabla nueva
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE empathic_interventions ENABLE ROW LEVEL SECURITY;

-- Política de lectura para usuario autenticado (solo sus propios datos)
CREATE POLICY "Users can only read own data"
ON customers FOR SELECT
USING (auth.uid() = user_id);
```

---

## 3. Manejo Seguro de Secretos y API Keys

* **Variables Públicas vs Privadas**:
  * `NEXT_PUBLIC_*`: Solo para valores seguros para el navegador (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
  * `SUPABASE_SERVICE_ROLE_KEY`: **Privada**. Tiene permisos de superadmin en la base de datos. Si se filtra en el cliente, cualquier usuario puede borrar o leer todas las tablas.
  * `LLM_API_KEY`, `ML_SERVICE_SECRET`: **Privadas**.
* **Protección de Repositorio**:
  * `.env`, `.env.local`, `.env.production` están estrictamente ignorados en `.gitignore`.
  * Nunca escribir credenciales hardcodeadas en código fuente.

---

## 4. Validación y Prevención de Inyección

* **Validación en Frontera con Zod**:
  * Todo dato recibido por API debe ser parseado estrictamente con `schema.safeParse()`.
  * No permitir campos desconocidos en objetos de mutación.
* **Consultas SQL**:
  * Usar siempre el cliente de Supabase / PostgREST con consultas parametrizadas.
  * Nunca concatenar strings directamente en consultas SQL sin sanitización.
