# Métricas y KPIs del Dashboard Operativo
## Cobranza Preventiva Empática con IA · Bancoagrícola (EntropyHack 2026)

> **Propósito:** Especificación funcional y técnica de las métricas cuantitativas, visualizaciones y datos auditables que se muestran en el Dashboard para ejecutivos del banco, supervisores de cobranza y oficiales de cumplimiento.
> **Enfoque:** 100% orientado a valor bancario, resultados medibles y telemetría operativa en producción (sin debates de arquitectura interna).

---

## 1. Resumen Ejecutivo de Paneles del Dashboard

El dashboard se organiza en **4 paneles de indicadores clave (KPIs)** y **1 vista de auditoría detallada fila por fila**:

1. **Panel de Negocio e Impacto Financiero:** Montos recuperados, tasa de acuerdos y ahorro operativo.
2. **Panel de Telemetría Técnica y SLAs de Voz:** Latencias (TTFB), duración de llamada y tiempos de consulta a base de datos.
3. **Panel de Calidad Conversacional y Empatía:** Evaluación automatizada de empatía, sentimiento del cliente y dialecto salvadoreño.
4. **Panel de Cumplimiento Normativo y Riesgo:** Tasa de respeto a guardrails, protección de PII y trazabilidad legal ante la SSF.
5. **Tabla de Auditoría y Detalle de Llamadas:** Historial auditable con reproductor, transcripción literal y resultado estructurado en base de datos.

---

## 2. Especificación Detallada de Métricas por Panel

### Panel 1: Impacto Financiero, Mitigación de Riesgo y Rentabilidad Activa

Métricas destinadas a demostrar tanto la efectividad del agente en la mitigación de mora como la generación activa de ingresos por monetización en clientes sanos (**Tier A Prime**).

| Métrica / KPI | Unidad | Cálculo Técnico en el Sistema | Visualización en UI | Valor Esperado / SLA |
|---|---|---|---|---|
| **Tasa de Compromiso de Pago** | Porcentaje (%) | `(Llamadas/chats con acuerdo exitoso / Total interacciones con mora) * 100` | **Tarjeta KPI grande** con badge de tendencia comparativa vs periodo anterior. | > 65% |
| **Monto en Riesgo Recuperado** | Dólares ($ USD) | Suma de montos de cuotas con acuerdo formal registrado en Postgres vs total en riesgo. | **Tarjeta KPI destacada** con barra de avance proporcional (Recuperado vs Meta). | Visualización directa en $ USD |
| **Provisiones Liberadas (NCB-022)** | Dólares ($ USD) | `Σ [ Saldo × (% Reserva sin intervención − % Reserva con acuerdo) ]` | **Tarjeta de ROI Regulatorio**: Capital líquido salvado de inmovilización en SSF. | Cuantificable en miles de USD |
| **Conversión Cross/Up-selling (Tier A)** | Porcentaje (%) | `(Ofertas comerciales aceptadas / Total ofertas presentadas a clientes sanos) * 100` | **Badge de Monetización Activa** con desglose por producto (Adelanto, Extrafinanciamiento). | > 18% de colocación digital |
| **Volumen de Colocación Originada** | Dólares ($ USD) | Suma de montos aprobados/desembolsados en productos cross/up-sell sin fricción. | **Tarjeta KPI de Nuevos Ingresos**: Crecimiento de cartera comercial activa. | Directo en $ USD |
| **Distribución de Soluciones Acordadas** | Cantidad y % | Conteo agrupado por campo `tipo_solucion`: `mover_a_quincena`, `abono_parcial`, `fraccionamiento`, etc. | **Gráfico de dona interactivo** con desglose porcentual por opción de negocio. | Distribución representativa |
| **Costo por Acuerdo Logrado (Unit Economics)** | Dólares ($ USD) | `Costo total de IA consumido en el periodo / Total de acuerdos exitosos` | **Tarjeta comparativa directa**: Costo IA vs Costo Call Center Humano ($0.85 USD ref). | < $0.10 USD por acuerdo |
| **Tasa de Contactabilidad Efectiva** | Porcentaje (%) | `(Interacciones atendidas por usuario / Total contactos emitidos) * 100` | **Minigráfico de barras** separando: Contestadas, Buzón de voz, Ocupado/No contesta. | > 55% en base contactable |

---

### Panel 2: Telemetría Técnica y SLAs de Voz (Operaciones y TI)

Métricas de rendimiento en tiempo real para garantizar que la experiencia telefónica no presente retrasos perceptibles ni fallas de audio.

| Métrica / KPI | Unidad | Cálculo Técnico en el Sistema | Visualización en UI | Valor Esperado / SLA |
|---|---|---|---|---|
| **Latencia de Respuesta (TTFB)** | Milisegundos (ms) | `timestamp_primer_byte_audio - timestamp_fin_voz_usuario` | **Tacómetro / Gauge con semáforo SLA**: Verde (< 1,000 ms), Amarillo (1,000 - 1,800 ms), Rojo (> 2,000 ms). | < 1,200 ms (Promedio objetivo: 600-800 ms) |
| **Duración Promedio de Llamada (AHT)** | Minutos / Segundos | Promedio de `duracion_segundos` de todas las llamadas con resultado efectivo. | **Tarjeta KPI numérica** (ej. `2m 35s`). | 2 a 4 minutos por gestión |
| **Latencia de Consulta a Base de Datos (Tools)** | Milisegundos (ms) | Tiempo de ejecución de function calls (`consultarCliente`, `registrarAcuerdo`) en Postgres/Supabase. | **Badge de salud de infraestructura**: `DB Query: XX ms`. | < 100 ms |
| **Tasa de Interrupciones Manejadas (Barge-in)** | Milisegundos / Conteo | Tiempo promedio en milisegundos para silenciar la salida de voz al detectar interrupción del usuario. | **Métrica de micro-rendimiento** en el panel de telemetría. | < 150 ms |
| **Gasto Operativo Diario Acumulado** | Dólares ($ USD) | Suma de costo en tiempo real calculada por segundo de STT/TTS y tokens de entrada/salida. | **Gráfico de área acumulativo** que muestra el consumo hora por hora del día. | Dentro de presupuesto asignado |

---

### Panel 3: Calidad Conversacional y Empatía (Criterio 20 pts Hackathon)

Evaluación objetiva y científica de la experiencia del cliente y la adecuación cultural a El Salvador.

| Métrica / KPI | Unidad | Cálculo Técnico en el Sistema | Visualización en UI | Valor Esperado / SLA |
|---|---|---|---|---|
| **Score de Empatía Global** | Escala 0 a 100 | Evaluación automática post-llamada con LLM-as-a-judge midiendo: escucha activa, validación emocional sin juicio y tono respetuoso. | **Medidor circular (Radial Gauge)** con clasificación: Excelente (90-100), Aceptable (75-89), Requiere Revisión (<75). | > 85 / 100 |
| **Evolución del Sentimiento del Cliente** | Estado inicial vs final | Análisis de sentimiento de la primera intervención del cliente vs su última intervención antes de despedirse. | **Gráfico de flujo o barras bidireccionales**: Clientes que pasaron de *Tensión/Angustia* a *Alivio/Tranquilidad*. | > 70% de viraje a tono neutro o positivo |
| **Fidelidad al Dialecto Local (Voseo Salvadoreño)** | Porcentaje (%) | Detección léxica del porcentaje de intervenciones que emplearon conjugaciones correctas de voseo natural (*"podés"*, *"tenés"*, *"fijate"*) vs tuteo o formalismo forzado. | **Barra de precisión lingüística** (ej. `98.2% Voseo Validado`). | > 95% |
| **Claridad de Términos Financieros** | Escala 0 a 100 | Verificación algorítmica de que montos, fechas y consecuencias fueron expresados sin ambigüedades. | **Checklist de calidad acústico-semántica**. | 100% |

---

### Panel 4: Cumplimiento Normativo, Seguridad y Riesgo (Auditoría SSF / Legal)

Métricas indispensables para la aprobación del Oficial de Cumplimiento y las normativas bancarias salvadoreñas.

| Métrica / KPI | Unidad | Cálculo Técnico en el Sistema | Visualización en UI | Valor Esperado / SLA |
|---|---|---|---|---|
| **Tasa de Cumplimiento de Políticas Bancarias** | Porcentaje (%) | `(Llamadas sin intento o con intento contenido exitosamente / Total llamadas) * 100` | **Badge de Escudo de Seguridad**: `100.0% Cumplimiento Normativo`. | 100% (Cero tolerancia a fugas de política) |
| **Intentos de Desvío Contenidos (Guardrails Activos)** | Conteo absoluto | Veces que el usuario solicitó condonaciones, plazos ilegales o productos ajenos y el agente mantuvo los límites oficiales. | **Contador de alertas de mitigación**: ej. `24 desvíos bloqueados con éxito`. | Tasa de contención = 100% |
| **Sanitización de Datos Personales (PII en Vuelo)** | Porcentaje y conteo | Porcentaje de identificaciones (DUI), números de tarjeta o teléfono enmascarados antes de registro en logs públicos. | **Badge de certificación de privacidad**: `100% PII Enmascarado`. | 100% |
| **Integridad de Registro de Acuerdos** | Porcentaje (%) | `(Acuerdos con JSON tipado válido insertado en Postgres / Acuerdos verbalizados en llamada) * 100` | **Indicador de consistencia de datos**: `100% Persistencia Consistente`. | 100% |

---

### Panel 5: Registro y Auditoría Individual de Llamadas (Ficha de Detalle)

Tabla interactiva situada en la zona inferior del dashboard con el historial cronológico de gestiones:

#### Columnas Principales de la Tabla:
1. **ID de Gestión:** Código único de llamada (`#CALL-2026-00481`).
2. **Cliente (Anonimizado):** Nombre inicial enmascarado y DUI protegido (`M. R*****, DUI: *****492-1`).
3. **Monto Pendiente:** Saldo de la cuota en riesgo gestionada (`$85.50 USD`).
4. **Resultado de la Llamada:** Badge de color:
   * `[COMPROMISO DE PAGO]` (Verde)
   * `[REAGENDADA / VOLVER A LLAMAR]` (Amarillo)
   * `[NO CONTACTADO / BUZÓN]` (Gris)
   * `[ESCALADO A EJECUTIVO HUMANO]` (Azul)
5. **Solución Formalizada:** Detalle del acuerdo (`Mover a quincena: 15-Sep-2026`).
6. **Latencia Promedio (TTFB):** Valor medido en la llamada (`610 ms`).
7. **Score de Empatía:** Puntuación auditada de esa sesión (`94/100`).
8. **Acciones Disponibles:**
   * Botón `[Ver Transcripción]`: Despliega el chat completo con marcas de tiempo y PII protegido.
   * Botón `[Ver Datos del Acuerdo]`: Muestra el payload JSON guardado en Supabase.
   * Botón `[Escuchar Grabación]`: Reproductor de audio con onda acústica de la conversación.

---

## 3. Modelo de Datos de Soporte en Base de Datos (Postgres / Supabase)

Para alimentar este dashboard de forma reactiva y en tiempo real, las llamadas y acuerdos se almacenan bajo la siguiente estructura relacional simplificada:

```sql
-- Tabla principal de registro y auditoría de llamadas
CREATE TABLE llamadas_cobranza (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id VARCHAR(50) NOT NULL,
    cliente_nombre_enmascarado VARCHAR(100) NOT NULL,
    dui_enmascarado VARCHAR(20) NOT NULL,
    monto_cuota_pendiente NUMERIC(10,2) NOT NULL,
    fecha_llamada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duracion_segundos INT NOT NULL,
    estado_resultado VARCHAR(30) NOT NULL, -- 'acuerdo', 'reagendada', 'buzon', 'escalada'
    tipo_solucion VARCHAR(50),            -- 'plazo_1_a_3_dias', 'mover_a_quincena', 'abono_parcial'
    monto_acordado NUMERIC(10,2),
    fecha_pago_acordada DATE,
    latencia_promedio_ttfb_ms INT NOT NULL,
    score_empatia INT CHECK (score_empatia BETWEEN 0 AND 100),
    sentimiento_inicial VARCHAR(20),     -- 'negativo', 'neutral', 'positivo'
    sentimiento_final VARCHAR(20),
    guardrail_violaciones INT DEFAULT 0,
    pii_enmascarado BOOLEAN DEFAULT TRUE,
    transcripcion_texto TEXT NOT NULL,
    metadata_json JSONB
);
```

---

## 4. Resumen de Valor para la Presentación al Jurado

Al presentar este dashboard, se evidencia que la solución de Bancoagrícola:
1. **Es viable financieramente:** Muestra ahorros operativos directos y recuperación de cartera tangible.
2. **Es ultra-rápida y natural:** Demuestra latencias de voz por debajo de 1 segundo y uso genuino del dialecto salvadoreño.
3. **Es segura y auditable:** Cumple con todas las exigencias de protección de datos (PII) y normativas de la Superintendencia del Sistema Financiero (SSF).
4. **Cumple con los requerimientos de la base del hackathon:** Entrega demostración estable, transcripción literal y resultado estructurado en base de datos.
