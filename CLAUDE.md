# CLAUDE.md — agricola-entropyhack

Contexto permanente del repositorio. Lo leen Claude Code, Cursor, Antigravity y cualquier agente que trabaje acá.

---

## 🏛️ Qué es esto

Entropy Hack 2026 · Key Institute · El Salvador · Reto **Bancoagrícola**.

**Plataforma**: **Anticipa Bancoagrícola** — Motor Predictivo, Cobranza Empática y Rentabilidad Activa.
La conversación no es una feature decorativa: **es el producto**.

**Flujo crítico:** `Conversar → Comprender → Adaptarse → Negociar → Cerrar → Registrar`

> *"No buscamos solo respuestas inteligentes. Buscamos una gestión completa, empática, trazable y orientada a un resultado."* — Bancoagrícola

**La tesis:** No es un cobrador hostil; es una conversación que protege el récord crediticio de la persona. El pago llega como consecuencia natural de eso. Además, monetiza clientes sanos convirtiendo la prevención en rentabilidad activa.

---

## 🌟 Tres Diferenciadores Clave

1. **Precisión Auditable (Cumplimiento SSF):**
   * Motor predictivo entrenado con datos de la industria.
   * Modelos explicables con **SHAP**, garantizando que cada probabilidad y motivo de contacto sea 100% auditable y transparente ante la SSF.
2. **Cobranza Empática y Accionable:**
   * La IA comprende el contexto real del deudor salvadoreño (quincenas 15/30, remesas, ventana legal de buró de 10 días, red de 890+ corresponsales).
   * Mapea automáticamente la situación del cliente a **productos reales de Bancoagrícola** mediante la escalera de 8 opciones.
3. **Rentabilidad Activa (Monetización Tier A):**
   * El sistema detecta clientes con deuda saldada o 0 días de atraso (**Tier A Prime**) y activa oportunidades de **cross-selling y up-selling** (Adelanto de Salario, Extrafinanciamiento limpio, upgrade de tarjeta).

---

## 🔄 Pipeline de la Aplicación

### 1. Flujo Outbound (Nosotros contactamos):
* **Batch diario nocturno (03:00 AM)** tras consolidación contable (EOD).
* **Capa reactiva de supresión:** Si el cliente paga durante el día, se cancela cualquier mensaje o llamada pendiente.
* **Evaluación de probabilidades de mora y segmentación por Tiers:**
  * **Tier A Prime (Deuda saldada / 0 días de mora):** Bypass de recordatorios de cobro. **Siempre enviar ofertas de Cross-selling y Up-selling.**
  * **Tier A Preventivo (0 a 14 días de atraso / cuota al día con riesgo):** Recordatorio amigable de bajo costo, facilidades operativas (mover fecha a la quincena, débito automático).
  * **Tier B (14 a 31 días) y Tier C (32 a 120 días):**
    * Envío prioritario de recordatorios digitales.
    * Agente conversacional empático: comprensión de causas, propuesta de abono parcial o fraccionamiento según reglas duras de elegibilidad del banco.
  * **Tier D-E+ (120 a 365+ días):**
    * Recordatorio formal de cierre.
    * **Menor esfuerzo del bot para rescatar al cliente:** la probabilidad de recuperación automatizada disminuye drásticamente; se tiende a **referir rápidamente a un agente humano** para atención personalizada o cobranza especializada.

### 2. Flujo Inbound (El cliente nos contacta):
* Atención receptiva omnicanal (WhatsApp/Web/Voz).
* **Enfoque inicial:** Contestar la duda o necesidad puntual del cliente.
* **Consulta en tiempo real a Supabase:** Predicción del modelo, score SHAP, perfil financiero, categoría NCB-022 y opciones elegibles.
* Negociación gobernada por reglas duras o escalamiento a humano si lo solicita o la situación lo amerita.

---

## 🎯 Criterios de Evaluación

| Criterio | Peso |
|---|---|
| Calidad conversacional | **20** |
| Efectividad de la gestión | **20** |
| Solidez técnica | **20** |
| Dashboard y datos | **10** |

---

## 🛠️ Stack y Operación

Next.js 14.2.24 · React 18 · TypeScript estricto · Tailwind 3 · Supabase PostgreSQL · microservicio Python FastAPI en `ml/`.

* `npm ci` para instalar dependencias (**nunca `npm install`**).
* `npm run db:migrate` y `npm run seed:apply` para esquema y datos deterministas.
* `npm run verify:reglas` (23 pruebas unitarias de negocio y validador).
* `npm run ataque` (batería de 20 ataques contra el agente).
* `/api/predict` tiene **Smart Fallback**: la app funciona al 100% aunque el microservicio Python no esté corriendo.

---

## 🚨 Reglas del Agente y Guardrails

* ❌ Nunca amenazar ni insinuar consecuencias legales o embargos.
* ❌ Nunca culpar ni juzgar.
* ❌ Nunca mencionar a terceros (familia, vecinos, empleador).
* ❌ Nunca ofrecer productos de otro banco.
* ❌ Nunca inventar productos, tasas o beneficios que no existan en el banco.
* ❌ Nunca aceptar plazos fuera de rango (máximo vencimiento o 1 a 3 días después; o mover a la quincena).
* ❌ Condonación de capital o intereses: estrictamente prohibida.
* ✅ **Una sola acción recomendada por mensaje** (evidencia PNAS 2025, 13M de personas).
* ✅ Siempre ofrecer salida a un humano.
* ✅ Cero jerga financiera con el cliente: decir "tu pago", "tu récord", "tu cuota" (nunca "score", "PD30", "provisión").
* ✅ Español salvadoreño cálido, voseo natural y máximo 2 a 3 frases por turno.
* ✅ **Validador determinista** auditando cada turno antes de responder.

---

## ⚖️ Normativa NCB-022 y Ley de Historial de Crédito

* **No es un promedio:** La clasificación NCB-022 (SSF) es una **foto puntual al cierre del mes** (*point-in-time*), no un promedio histórico.
* **Pago total:** Si el cliente cancela la totalidad de la mora antes del corte, al cierre califica automáticamente en **Categoría A1 (0 días de mora)** y el banco libera el 100% de la reserva.
* **Período de cura (Reestructuraciones):** Si un crédito se reestructura, la norma prohíbe subirlo de golpe a Categoría A; exige 4 meses continuos para subir a B y de 6 a 12 meses continuos de pago puntual para volver a A.
* **Principio de Calificación Integral (Contagio):** Un deudor no puede tener calificaciones dispersas en créditos sin garantía en Bancoagrícola (el peor crédito arrastra a los demás). El contagio interbancario por reporte de otro banco en la Central de Riesgos de la SSF (>20% de pasivos) también deteriora la calificación.
* **Buró vs NCB-022:** La NCB-022 mide reservas líquidas que el banco aparta; la ley de burós regula el historial del cliente (los burós actualizan del 1 al 10 del mes, y deben eliminar reportes negativos al día hábil siguiente de saldada la deuda).
