# Dossier de Investigación, Estrategia y Personajes — Bancoagrícola EntropyHack 2026

> **Reto:** *"¿Cómo evitar que un usuario caiga en mora antes de que suceda? La cobranza tradicional reacciona tarde, y la falta de seguimiento oportuno provoca que miles de personas arruinen su historial crediticio. Transforma la cobranza en una experiencia empática con enfoque preventivo que vela por el récord crediticio de los usuarios."*

---

## 1. El Evento y Criterios del Jurado

* **Fecha y Formato:** 12–13 de septiembre de 2026 (24 horas continuas). Campus Key Institute, Edificio FEPADE, Antiguo Cuscatlán, El Salvador.
* **Organizadores y Retadores:** Key Institute + Perpetuo. Retadores: **Bancoagrícola** y **Grupo Econ**.
* **Composición del Panel Evaluador:** Perfiles bancarios, directores de innovación y tecnología de Bancoagrícola (Grupo Cibest / Bancolombia).
* **Señal Estratégica Clave:** Los perfiles solicitados para el hackathon son *Desarrollador (IA)*, *Diseñador de Experiencias* y *Tech-Negocios*. Esto indica que **un modelo técnico brillante sin narrativa de usuario ni caso de negocio financiero pierde contra un prototipo sólido y bien contado**.

---

## 2. Radiografía de Bancoagrícola (El Salvador)

* **Liderazgo de Mercado:** Banco #1 de El Salvador, concentrando el **24% de los activos** y el **24.2% de la cartera bruta** del sistema bancario nacional (Ranking ABANSA).
* **Grupo Empresarial:** Filial de **Grupo Cibest** (nueva matriz corporativa de Grupo Bancolombia desde 2025).
* **Inversión Tecnológica:** $22.42 M en 2026 (+40% vs 2025), de los cuales **$17.5 M se destinan directamente a transformación digital y tecnología**.
* **Banca Digital:** **750,000 clientes activos** en su banca móvil (App con calificación 4.8★ y más de 1 millón de descargas).
* **Penetración Juvenil (Nequi El Salvador):** La fintech del grupo cuenta con un **71% de usuarios menores de 35 años**, representando el segmento de mayor dinamismo y nuevo acceso al crédito.
* **Red Física y Capilaridad:** 62 agencias bancarias y **+890 corresponsales financieros** con presencia en el **100% de los distritos** del país.
* **Productos Crediticios Existentes (Palanca de 90 días):** Adelanto de Salario, Extrafinanciamiento, Sobregiro Elite, Tarjeta Clásica/Oro/Black y Crédito Personal.
  > **Argumento de Pitch:** El producto se apalanca en infraestructura que el banco **ya tiene operando**, haciéndolo viable para producción en 90 días en lugar de requerir años de desarrollo regulatorio.

---

## 3. Contexto del Sistema Financiero Salvadoreño (Datos ABANSA)

* Cartera total del sistema: **$19,978.8 M** (+10.4% anual).
* Cartera de consumo y vivienda: **$9,348.2 M** (+6.9%).
* Tarjetas de crédito: **$1,374 M** (+10.8%).
* **Índice de Morosidad Nacional:** **1.50%** (las reservas cubren el 146% de la mora).
* ⚠️ **Trampa de Framing Evitada:** **No se debe vender la idea de una "crisis de impago"**, ya que 1.50% es una de las tasas de mora más bajas de la región y el jurado bancario lo sabe perfectamente.
  * **El Framing Ganador:** *La cartera crece al 10% anual y la nueva originación es digital y joven; el riesgo no está en el stock actual, sino en el flujo y en evitar que los nuevos entrantes dañen su récord por descalces operativos de calendario.*

---

## 4. Marco Regulatorio y Legal (Ventajas Inéditas)

1. **Ley de Regulación de los Servicios de Información sobre el Historial de Crédito (Reforma 2021):**
   * **La Ventana Legal de los 10 Días:** Los burós de crédito en El Salvador (Equifax, TransUnion, InfoRed) **actualizan sus bases de datos exclusivamente durante los primeros 10 días de cada mes calendario**.
   * Si un cliente entra en atraso pero regulariza su situación antes del día 10, **la mora técnica jamás llega a manchar su récord crediticio ante el sistema financiero**.
   * Finiquito de cancelación obligatorio en un plazo máximo de 7 días hábiles.
2. **Ley de Protección al Consumidor (Art. 18):**
   * Prohíbe explícitamente métodos de cobranza difamatorios, intimidantes, hostigadores o que atenten contra la privacidad del deudor. **El tono empático no es solo buena UX: es estricto cumplimiento legal.**
3. **Norma Técnica de Riesgo NCB-022 (Superintendencia del Sistema Financiero - SSF):**
   * Clasifica los activos de riesgo por tramos de días de atraso (Categorías A1, A2, B, C1, C2, D1, D2, E) y define el porcentaje de reserva que el banco debe inmovilizar por cada tramo. Prevenir la caída de categoría ahorra millones en reservas líquidas al banco.

---

## 5. Evidencia Académica y de Comportamiento (PNAS 2025)

Estudio de campo publicado en PNAS evaluando intervenciones en más de 13 millones de deudores crediticios:
* Recordatorios conductuales oportunos reducen la morosidad a 60 días en **0.42 puntos porcentuales**.
* Con recordatorios de seguimiento empáticos: reducción de **0.57 pp**.
* Enmarcar el alivio en **porcentaje de esfuerzo** en vez de montos absolutos incrementa la respuesta en +0.14 pp.
* **Una sola acción clara recomendada por mensaje** tiene una tasa de conversión 3 veces mayor que presentar múltiples opciones simultáneas.

---

## 6. Concepto de Producto: "Al Día"

> *"Tu récord crediticio, cuidado antes de que se rompa."*

El cambio de paradigma: La cobranza tradicional exige al cliente el dinero del banco desde la hostilidad. **Nuestra plataforma cuida el récord crediticio del cliente; el pago ingresa al banco como consecuencia natural.**

### Las 4 Piezas del Sistema:
1. **Motor de Anticipación (Inferencia ML):** Cálculo continuo de probabilidad de atraso a 30 días (PD30), estrictamente **explicable** (factores SHAP / top features en lenguaje natural).
2. **Orquestador de Intervenciones Mínimas Suficientes:** Aplica el escalón de menor costo antes de escalar:
   * Nivel 1: Recordatorio amistoso en el momento óptimo (Costo ~$0).
   * Nivel 2: **Alineación de la fecha de pago a la quincena (Costo ~$0 — La solución estrella).**
   * Nivel 3: Abono parcial que evita la degradación de categoría NCB-022.
   * Nivel 4: Micro-plan de cuota dividida en dos quincenas sin penalización.
   * Nivel 5: Pausa o diferimiento de una cuota en temporada baja.
   * Nivel 6: Reestructuración preventiva con tasa preferencial.
3. **Escudo del Récord Crediticio (Vista del Cliente):** Muestra el estado del récord y, en caso de atraso, activa el **contador honesto de la ventana de 10 días**:
   > *"Tu pago se reporta a los burós el 10 de octubre. Te quedan 4 días. Abona $25.00 hoy para mantener tu récord 100% impecable."*
4. **Consola del Asesor:** Priorización de casos por **impacto financiero evitable en dólares** (ahorro de reservas NCB-022) en lugar de días de mora, con generación de mensajes empáticos.

### Los 5 Insights Diferenciadores del Pitch:
1. **La Quincena (15 y 30):** En El Salvador la masa laboral cobra los días 15 y 30. Si la cuota vence el día 8, el cliente cae en mora técnica recurrente por descalce de liquidez. Ajustar la fecha cuesta $0.
2. **Las Remesas Familiares (~24% del PIB):** Bancoagrícola ya procesa remesas en su app. Una fluctuación en la fecha habitual de envío de la remesa es una señal predictiva temprana que **ningún buró externo posee**.
3. **La Ventana Legal de los 10 Días:** Exclusiva de la legislación salvadoreña. Nadie más la transparenta al usuario.
4. **Los 890 Corresponsales Financieros:** Para usuarios no bancarizados digitalmente, el mensaje indica el punto físico más cercano a su domicilio para realizar su abono.
5. **Apalancamiento en Productos Existentes:** Adelanto de Salario o Extrafinanciamiento para resolver la pre-mora sin trámites nuevos.

---

## 7. Los 8 Personajes Héroe del Demo

Estos personajes están diseñados con parámetros sociodemográficos y financieros reales de El Salvador para demostrar cada faceta del sistema ante el jurado:

| Slug | Nombre y Edad | Distrito | Ingreso / Tipo | Producto y Saldo | Patrón que Demuestra | Historia para el Pitch |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `karla` | **Karla Menjívar** (27) | Soyapango | $480 / Quincenal (15 y 30) | Tarjeta Clásica<br>Saldo: $1,240.50<br>Cuota: $148.75 (Vence día 8) | **Desalineación quincena ↔ fecha de pago (Caso estrella con el que abre el pitch)** | Cobra el 15 y el 30. Su cuota vence el 8, cuando ya no tiene liquidez. Paga tarde todos los meses sin ser mala pagadora. Mover su fecha al día 16 resuelve el problema a costo cero. |
| `jose` | **José Portillo** (41) | Chalatenango | $350 / Remesa mensual (Día 5) | Crédito Personal<br>Saldo: $3,800.00<br>Cuota: $312.00 (Vence día 3) | **Remesa que llega después del corte (El foso defensivo)** | Su hermana le envía la remesa el día 5. La cuota vence el 3. Esos 2 días de desfase lo marcan en mora 12 veces al año. Bancoagrícola ya ve entrar la remesa en su app antes que nadie. |
| `rosa` | **Rosa Hernández** (52) | San Miguel | $620 / Negocio informal irregular | Crédito Vehicular<br>Saldo: $8,450.00<br>Cuota: $421.50 | **Ingreso irregular + estacionalidad comercial** | Dueña de una tienda. Sus ingresos caen un 40% en septiembre de forma cíclica. Requiere un micro-plan de dos cuotas durante la temporada baja, no llamadas de cobro. |
| `wilber` | **Wilber Alvarenga** (23) | Santa Tecla | $400 / Quincenal | Tarjeta Joven<br>Saldo: $680.00<br>Cuota: $68.00 (Atraso: 6 días) | **En atraso dentro de la ventana de reporte de 10 días** | Primer crédito de su vida. Se atrasó 6 días por olvido. Faltan 4 días para que el buró consolide. Si paga sus $68 hoy, su récord queda limpio antes del corte del día 10. |
| `marta` | **Marta Cruz** (34) | Antiguo Cuscatlán | $1,100 / Quincenal | Crédito Vivienda<br>Saldo: $42,000.00<br>Cuota: $385.00 | **Cliente de Control Sano (Indispensable para el demo)** | Paga puntual o por adelantado desde hace 3 años. El sistema NO la contacta. Demuestra al jurado que el motor no genera falsos positivos ni satura a clientes sanos. |
| `nelson` | **Nelson Rivas** (38) | Ahuachapán | $750 / Mensual | Extrafinanciamiento<br>Saldo: $2,100.00<br>Cuota: $195.00 | **Uso creciente de línea rotativa (Estrés silencioso)** | Lleva 4 meses consecutivos incrementando el uso de su extrafinanciamiento. Nunca se ha atrasado, pero tapa una deuda con otra. Es el candidato idóneo para consolidación preventiva. |
| `sandra` | **Sandra Beltrán** (29) | Mejicanos | $520 / Quincenal | Crédito de Estudio<br>Saldo: $5,600.00<br>Cuota: $210.00 | **Abono parcial que salva la categoría de riesgo** | Este mes solo dispone de $170 de los $210. Un abono parcial de $170 evita que su crédito se reclasifique a categoría B en la NCB-022. La cobranza tradicional exige todo o nada. |
| `don-tito` | **Alberto 'Tito' Guevara** (67) | Santa Ana | $290 / Pensión mensual (Día 1) | Crédito Personal<br>Saldo: $900.00<br>Cuota: $85.00 | **Canal no digital / Corresponsal financiero** | No utiliza smartphone. La intervención se realiza vía SMS indicándole la ubicación y distancia del corresponsal financiero Bancoagrícola más cercano para su pago en efectivo. |

---

## 8. Principios de UX y Diseño Ético

1. **El Cliente Nunca Ve Rojo:**
   * En la psicología financiera salvadoreña, el color rojo genera culpa, angustia y evasión (el usuario opta por desinstalar o no abrir la banca móvil).
   * La interfaz del cliente utiliza tonos de tranquilidad (`ok` verde esmeralda `#28A745`, `watch` ámbar cálido `#E0A800`, `shield` azul protector `#003B71`). El estado de alerta punitiva queda estrictamente reservado para la consola administrativa interna.
2. **Accesibilidad del Amarillo Corporativo (`#FDDA24`):**
   * El amarillo corporativo de Bancoagrícola tiene un ratio de contraste de ~1.5:1 sobre blanco (reprobando WCAG AA).
   * **Regla mandataria:** El amarillo se utiliza **únicamente como fondo de relleno** (botones o badges) con texto oscuro `#282828` encima (contraste superior a 11:1). Nunca como color de texto sobre fondo blanco.
