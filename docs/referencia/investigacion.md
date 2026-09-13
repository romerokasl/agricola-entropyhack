# Dossier de Investigación, Estrategia y Personajes — Anticipa Bancoagrícola

> **Plataforma**: **Anticipa Bancoagrícola** — Motor Predictivo, Cobranza Empática y Rentabilidad Activa (EntropyHack 2026).
>
> **Reto**: *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."*

---

## 1. El Evento y Criterios del Jurado

* **Fecha y Sede:** 12–13 de septiembre de 2026 (24 horas continuas). Campus Key Institute, Edificio FEPADE, Antiguo Cuscatlán, El Salvador.
* **Organizadores y Retadores:** Key Institute + Perpetuo. Retador Oficial: **Bancoagrícola** (Grupo Cibest / Bancolombia).
* **Panel Evaluador:** Directores de Cobranzas, Gerencia de Capacidades Analíticas e Innovación Tecnológica de Bancoagrícola.
* **Ponderación Técnica:** Calidad Conversacional (**20**), Efectividad de Gestión (**20**), Solidez Técnica (**20**), Dashboard y Datos (**10**). Subtotal Técnico: 70 pts.

---

## 2. Radiografía de Bancoagrícola y Sistema Financiero

* **Liderazgo Nacional:** Banco #1 de El Salvador con **24% de los activos** y **24.2% de la cartera crediticia bruta** (Ranking ABANSA).
* **Grupo Empresarial:** Filial de **Grupo Cibest** (matriz de Bancolombia desde 2025).
* **Transformación Digital:** Inversión de **$17.5 M anuales en tecnología**. Más de **750,000 clientes activos en banca móvil**.
* **Red Física:** 62 agencias y **+890 corresponsales financieros** cubriendo el **100% de los distritos** del país.
* **Cartera Nacional:** $19,978.8 M total; $9,348.2 M consumo y vivienda; $1,374 M tarjetas de crédito.
* **Índice de Morosidad Nacional:** **1.50%** (las reservas cubren el 146% de la mora).
  * ⚠️ **Framing Ganador de Negocio:** La morosidad nacional es baja; el problema de Bancoagrícola no es una crisis masiva de impago estructural, sino el **descalce operativo y la mora temprana en 27,000 clientes mensuales (90% del total en incumplimiento)**. Se recuperan con una conversación preventiva empática antes de generar provisiones regulatorias.

---

## 3. Marco Regulatorio y Legal: El Dictamen Técnico

### A. Norma Técnica NCB-022 / NCBC-022 (Superintendencia del Sistema Financiero - SSF)
1. **Evaluación Mensual Puntual ("Foto del Momento"):**
   * La clasificación de riesgo para créditos de consumo y tarjetas **NO es un promedio histórico ponderado**. Se calcula al cierre de cada mes según los **días de mora de la cuota impagada más antigua**.
   * Si el cliente paga todo de golpe antes del corte contable, califica de nuevo en **Categoría A1 (0 días)** y el banco libera de inmediato la reserva de saneamiento.
2. **Exigencia de Reservas por Categoría (Consumo):**
   * **A1 (0 días):** 0% a 1% de provisión.
   * **A2 (1 a 30 días):** 1% de provisión.
   * **B (31 a 60 días):** 5% de provisión.
   * **C1 (61 a 90 días):** 15% de provisión.
   * **C2 (91 a 120 días):** 25% a 30% de provisión.
   * **D1/D2 (121 a 180 días):** 50% a 75% de provisión.
   * **E (>180 días):** 100% de provisión.
3. **Período de Prueba/Cura en Reestructuraciones:**
   * La norma prohíbe ascender de inmediato a Categoría A un crédito reestructurado. Exige **4 meses continuos de pago puntual para subir a Categoría B**, y entre **6 y 12 meses continuos** para volver formalmente a Categoría A.
4. **Principio de Calificación Integral y Efecto Contagio:**
   * **Contagio Interno (Art. 9):** Un deudor no puede tener calificaciones dispersas en créditos sin garantía en Bancoagrícola. Si tiene un préstamo al día pero una tarjeta en C2, *ambos créditos se arrastran a C2*.
   * **Contagio Interbancario (Art. 13):** Reportes en la Central de Riesgos de la SSF por otros bancos que representen >20% de los pasivos del deudor obligan a reclasificarlo a la categoría deteriorada en Bancoagrícola, salvo garantías hipotecarias de primer orden inscritas.

### B. Ley de Regulación de los Servicios de Información sobre el Historial de Crédito (Burós)
* **Ventana Legal de 10 Días:** Los burós (Equifax, TransUnion, InfoRed) consolidan datos los primeros 10 días de cada mes.
* **Eliminación Inmediata de Reporte Negativo:** Al liquidar la deuda por completo, la ley salvadoreña vigente obliga al buró a retirar la anotación de mora **a más tardar el siguiente día hábil**.

### C. Ley de Protección al Consumidor (LPC)
* **Horario Legal de Contacto:** Lunes a viernes de 8:00 a.m. a 6:00 p.m. Prohibido contacto en fines de semana o feriados.
* **Prohibición de Acoso:** Ilegal utilizar tácticas intimidantes, difamatorias o dirigidas a terceros (familiares, empleador).

---

## 4. Tres Diferenciadores Oficiales

1. **Precisión Auditable (Cumplimiento SSF):**
   * Inferencia predictiva con **SHAP (TreeExplainer)**. Cada predicción es auditable ante inspectores de la SSF, explicando exactamente por qué se interviene al cliente.
2. **Cobranza Empática y Accionable:**
   * Análisis de factores culturales (quincena 15/30, remesas, corresponsales).
   * Mapeo automatizado a soluciones reales mediante la escalera de 8 opciones.
3. **Rentabilidad Activa (Monetización Tier A):**
   * El sistema no se limita a evitar pérdidas: identifica clientes en **Tier A Prime (0 días de mora o deuda saldada)** y activa **cross-selling y up-selling** de productos bancarios de alta calidad.

---

## 5. Arquitectura del Pipeline: Outbound e Inbound

### Flujo Outbound (Iniciado por el Banco):
1. **Batch Diario Nocturno (03:00 AM)** tras consolidación del EOD.
2. **Capa de Supresión Reactiva:** Cero llamadas o mensajes a clientes que hayan pagado durante el día.
3. **Bifurcación por Estado de Deuda:**
   * **Deuda Saldada / Cuota al día (Tier A Prime):** Bypass de recordatorios de cobranza $\rightarrow$ **Envío de ofertas comerciales de Cross/Up-selling**.
   * **Cuota Pendiente:** Inferencia ML y clasificación operativa:
     * **Tier A Preventivo (0-14 días):** Recordatorio amigable y facilidades operativas.
     * **Tier B (14-31 días) y Tier C (32-120 días):** Recordatorio prioritario + agente conversacional empático con reglas duras.
     * **Tier D-E+ (120-365+ días):** Recordatorio formal; **menor esfuerzo de rescate por bot y derivación inmediata a ejecutivo humano**.

### Flujo Inbound (Iniciado por el Cliente):
1. El cliente entra por WhatsApp, Web o Voz.
2. El agente se enfoca de inmediato en atender su consulta puntual.
3. Consulta reactiva a Supabase: score predictivo, factores SHAP, perfil financiero y soluciones elegibles.
4. Conducción a acuerdo registrado o transferencia a humano.

---

## 6. Los 8 Personajes Héroes del Demo

| Slug | Nombre y Edad | Segmento y Ubicación | Ingreso / Ciclo | Producto y Deuda | Patrón que Demuestra en el Demo |
|---|---|---|---|---|---|
| `karla` | **Karla Menjívar** (27) | Asalariada, Soyapango | $480 / Quincenal (15 y 30) | Tarjeta Clásica<br>Cuota: $145.00 (Vence día 8) | ⭐ **Caso Estrella:** Descalce quincena ↔ vencimiento. El agente detecta que cobra el 15 y mueve la fecha al 16 a costo $0. |
| `jose` | **José Portillo** (41) | Remesas, Chalatenango | $350 / Remesa (Día 5) | Crédito Personal<br>Cuota: $312.00 (Vence día 3) | **Señal exclusiva del banco:** Remesa que entra 2 días después de la cuota. Se ajusta la fecha usando datos que ningún buró tiene. |
| `wilber` | **Wilber Alvarenga** (23) | Joven, Santa Tecla | $400 / Quincenal | Tarjeta Joven<br>Cuota: $68.00 (Atraso: 6 días) | **Ventana de 10 días de buró:** El agente le muestra la ventana legal honesta para pagar y evitar reporte a burós. |
| `sandra` | **Sandra Beltrán** (29) | Asalariada, Mejicanos | $520 / Quincenal | Crédito Personal<br>Cuota: $210.00 | **Abono Parcial:** Solo junta $170; el agente formaliza el abono parcial para evitar que caiga a Categoría B (ahorrando reservas). |
| `rosa` | **Rosa Hernández** (52) | Negocio Informal, San Miguel | $620 / Ingreso irregular | Crédito Vehicular<br>Cuota: $421.50 | **Estacionalidad comercial:** Caída estacional de ventas en septiembre; el agente propone un micro-plan fraccionado en dos cuotas. |
| `nelson` | **Nelson Rivas** (38) | Asalariado, Ahuachapán | $750 / Mensual | Extrafinanciamiento<br>Cuota: $195.00 | **Estrés silencioso:** Uso creciente de línea rotativa; intervención preventiva antes de generar mora. |
| `don-tito` | **Alberto 'Tito' Guevara** (67) | Senior, Santa Ana | $290 / Pensión (Día 1) | Crédito Personal<br>Cuota: $85.00 | **Inclusión física (890+ Corresponsales):** No usa smartphone; atención guiada para pago presencial en su distrito. |
| `marta` | **Marta Cruz** (34) | Asalariada, Antiguo Cuscatlán | $1,100 / Quincenal | Crédito Vivienda<br>Cuota: $385.00 | ⭐ **Caso de Control (409):** Cliente al día con débito automático. El sistema **NO** la contacta para cobro; solo califica para Up-selling comercial. |
