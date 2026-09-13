# Especificación y Diagramas UML del Dominio — Bancoagrícola EntropyHack

> **Nota de Cumplimiento Normativo del Hackathon:**
> Este documento contiene únicamente el **diseño conceptual, arquitectura de entidades y diagramas UML/ER (pseudo-esqueleto)**. 
> No contiene código ejecutable SQL ni scripts de base de datos pre-construidos, cumpliendo con la normativa del evento de no generar código previo.

> ⚠️ **Este documento describe el dominio PRE-PIVOTE (el scorer preventivo con
> pantallas), no el agente conversacional.** Quedó desalineado con el brief oficial del
> 12 de septiembre en tres puntos concretos:
>
> 1. **No tiene tabla de conversación ni de acuerdo**, que es justo la evidencia que el
>    banco pide textual ("transcripción y resultado").
> 2. `PREVENTIVE_INTERVENTION.escalon_costo` dice "1 a 6"; la escalera real tiene **8**
>    escalones.
> 3. Su enum `tipo_intervencion` no coincide con la escalera: le faltan débito
>    automático, Adelanto de Salario/Extrafinanciamiento, reestructura y pase a humano,
>    y agrega "PausaCuota"/"Corresponsal", que no son escalones. **Codificar la escalera
>    desde acá rompería el guardrail "si no está en la lista, no existe".**
>
> **Fuentes autoritativas:** la escalera y los límites de negociación están en
> `docs/contexto/01-reglas-del-agente.md` §2–§3; el esquema vigente del agente son las
> 4 tablas de `supabase/migrations/`. Este UML se conserva como referencia de dominio y
> como insumo de una fase 2.

---

## 1. Diagrama Entidad-Relación Conceptual (ERD)

```mermaid
erDiagram
    CUSTOMER ||--o{ CREDIT_OBLIGATION : "posee"
    CUSTOMER ||--o{ FINANCIAL_BEHAVIOR : "registra"
    CUSTOMER ||--o{ RISK_SCORE : "evaluado_por"
    CREDIT_OBLIGATION ||--o{ PAYMENT_EVENT : "genera"
    CREDIT_OBLIGATION ||--o{ PREVENTIVE_INTERVENTION : "recibe"
    CREDIT_OBLIGATION ||--o{ BUREAU_WINDOW : "sujeta_a"

    CUSTOMER {
        UUID id PK "Identificador único"
        string dui_enmascarado "Documento de identidad protegido"
        string nombre_completo "Nombre del cliente"
        string distrito "Distrito geográfico (El Salvador)"
        string segmento "Asalariado, Remesas, Independiente, Joven, Senior"
        string tipo_ingreso "Quincenal (15/30), Mensual, Irregular"
        int dia_ingreso_1 "Día principal de cobro (ej. 15)"
        int dia_ingreso_2 "Segundo día de cobro (ej. 30)"
        int antiguedad_meses "Meses de relación con Bancoagrícola"
    }

    CREDIT_OBLIGATION {
        UUID id PK "Identificador de la obligación"
        UUID cliente_id FK "Referencia a Customer"
        string tipo_producto "Tarjeta, Personal, Vehículo, Extrafinanciamiento"
        string numero_cuenta_enmascarado "Identificador comercial protegido"
        decimal limite_o_monto "Monto otorgado o límite"
        decimal saldo_actual "Saldo adeudado a la fecha"
        decimal cuota_regular "Monto de la cuota mensual"
        int dia_corte "Día del mes de corte"
        int dia_pago "Día del mes límite de pago"
        decimal tasa_interes "Tasa de interés pactada"
        string categoria_riesgo_actual "A1, A2, B, C1, C2, D1, D2, E (Norma SSF NCB-022, Art.18) — ver docs/contexto/03-productos-y-ncb022.md"
        int dias_mora_cuota_mas_antigua "Base real de la clasificación (Anexo 1, num.9): decide la categoría"
        boolean tiene_debito_automatico "Indicador de adhesión a débito"
    }

    FINANCIAL_BEHAVIOR {
        UUID id PK "Identificador de métrica"
        UUID cliente_id FK "Referencia a Customer"
        decimal ingreso_mensual_estimado "Ingreso recurrente en USD"
        decimal ratio_dti "Debt-to-Income: Deuda / Ingreso"
        decimal utilizacion_linea "Porcentaje de uso de línea disponible"
        decimal variacion_ahorros_3m "Variación en depósitos/ahorros (-100% a +100%)"
        int atrasos_recientes_semestre "Cantidad de atrasos en últimos 6 meses"
        decimal volatilidad_gastos "Desviación estándar de egresos recientes"
        boolean remesa_retrasada "Señal de desfase en recepción de remesa habitual"
        boolean desalineacion_quincena "Detección de pago antes del cobro de quincena"
        timestamp fecha_calculo "Momento de cómputo de la métrica"
    }

    RISK_SCORE {
        UUID id PK "Identificador de la evaluación"
        UUID cliente_id FK "Referencia a Customer"
        int indice_riesgo "Score normalizado de 0 a 100"
        string nivel_severidad "LOW, MODERATE, MODERATE_HIGH, CRITICAL"
        decimal probabilidad_atraso_30d "Probabilidad matemática PD30 (0.0000 a 1.0000)"
        jsonb razones_explicables "Top 3 factores de estrés SHAP (Obligatorio)"
        string version_modelo "Identificador del modelo en producción"
        timestamp fecha_evaluacion "Fecha de la inferencia"
    }

    PREVENTIVE_INTERVENTION {
        UUID id PK "Identificador de la intervención"
        UUID obligacion_id FK "Referencia a CreditObligation"
        string tipo_intervencion "AlineacionQuincena, Recordatorio, AbonoParcial, CuotaDividida, PausaCuota, Corresponsal"
        int escalon_costo "Nivel de 1 a 6 (menor a mayor costo)"
        string mensaje_empatico "Copy personalizado según principios éticos"
        jsonb detalle_propuesta "Parámetros de la facilidad (nueva fecha, quincenas, etc.)"
        string canal "BancaMovil, WhatsApp, SMS, Corresponsal"
        string estado "Propuesta, Vista, Aceptada, Rechazada, Resuelta"
        timestamp fecha_envio "Momento de emisión"
        timestamp fecha_respuesta "Momento de respuesta del cliente"
    }

    BUREAU_WINDOW {
        UUID id PK "Identificador del ciclo de buró"
        UUID obligacion_id FK "Referencia a CreditObligation"
        int dias_atraso_actuales "Días transcurridos desde el vencimiento"
        int dias_restantes_ventana "Días hasta el corte de reporte (día 10 del mes)"
        date fecha_limite_reporte "Fecha fatal de consolidación en burós"
        decimal monto_minimo_limpieza "Monto para evitar el reporte a burós"
        boolean reporte_evitado "Indica si se previno la mancha en el récord"
    }

    PAYMENT_EVENT {
        UUID id PK "Identificador del pago"
        UUID obligacion_id FK "Referencia a CreditObligation"
        decimal monto_pagado "Valor abonado en USD"
        date fecha_programada "Fecha en la que debía pagarse"
        date fecha_real "Fecha en la que efectivamente se pagó"
        int dias_diferencia "fecha_real - fecha_programada"
        string canal_pago "Digital, Sucursal, Corresponsal_890"
    }
```

---

## 2. Diagrama de Clases y Arquitectura de Dominio (UML)

```mermaid
classDiagram
    class Customer {
        +UUID id
        +string duiMasked
        +string fullName
        +string district
        +IncomeType incomeType
        +int primaryPayday
        +int? secondaryPayday
        +hasPaydayMismatch(int dueDay) bool
    }

    class CreditObligation {
        +UUID id
        +string accountNumberMasked
        +ProductType productType
        +decimal balance
        +decimal minimumPayment
        +int cutDay
        +int dueDay
        +RiskCategory nc022Category
        +getDaysOverdue() int
    }

    class AnticipationEngine {
        +calculatePD30(FinancialBehavior metrics) RiskScore
        +extractTopRiskFactors(FinancialBehavior metrics) List~Reason~
    }

    class InterventionOrchestrator {
        +determineMinimalSufficientAction(RiskScore score, CreditObligation obligation) PreventiveIntervention
        +formatEmpatheticMessage(PreventiveIntervention action, Customer customer) string
    }

    class BureauShield {
        +calculateRemainingWindow(CreditObligation obligation) BureauWindow
        +isReportingImminent(BureauWindow window) bool
    }

    Customer "1" *-- "many" CreditObligation
    AnticipationEngine ..> RiskScore : produce
    InterventionOrchestrator ..> PreventiveIntervention : orquesta
    BureauShield ..> BureauWindow : calcula
```

---

## 3. Lógica de Interacciones y Reglas del Dominio

### A. La Regla de la Quincena (Alineación de Calendario)
* **Condición:** Si `Customer.tipo_ingreso == "quincenal"` y los días de cobro son 15 y 30, pero `CreditObligation.dia_pago` se ubica entre el día 5 y el 12.
* **Diagnóstico:** Desalineación estructural de calendario (estrés técnico por falta de liquidez post-gastos de mes).
* **Acción Orquestada:** Intervención Nivel 2: Mover la fecha de corte/pago al día 16 sin costo financiero.

### B. El Escudo de los 10 Días (Ventana Legal de Buró)
* **Condición:** Si `CreditObligation.getDaysOverdue() > 0` y la fecha actual es anterior al día 10 del mes siguiente.
* **Diagnóstico:** El cliente está en mora operativa interna, pero aún no se ha consolidado el reporte ante Equifax/TransUnion.
* **Acción Orquestada:** Notificación transparente con contador de días restantes y opción de pago mínimo/parcial para extinguir la deuda antes del corte.

### C. Inclusión de Canal Físico (890 Corresponsales)
* **Condición:** Si el cliente pertenece al segmento `senior` o no registra actividad en la banca móvil en los últimos 90 días.
* **Acción Orquestada:** Canalización vía SMS indicando la dirección del corresponsal financiero Bancoagrícola más cercano para pago presencial sin fricción digital.
