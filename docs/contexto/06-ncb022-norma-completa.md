# NCB-022 — Texto oficial transcrito + reglas de producto para el agente

> **Qué es este archivo:** la transcripción completa de la norma NCB-022 (Superintendencia del Sistema Financiero, El Salvador), hecha directamente del PDF oficial escaneado — no de un resumen de terceros — más una sección final con las reglas de cada producto de **Consumo y Vivienda** convertidas a un formato que el agente puede usar para decidir, en cada turno, si un producto es válido para ofrecer.
>
> **Para qué sirve:** es la referencia que el modelo (o el validador determinista) debe consultar antes de proponer cualquier producto. Si un producto no aparece aquí como válido para el estado del cliente, **no se ofrece** — es la aplicación directa del guardrail "nunca ofrezcas un producto que no esté en la lista de opciones válidas" (`01-reglas-del-agente.md`, regla #5).
>
> **Decisión de alcance del equipo:** el proyecto trabaja **únicamente con los grupos Consumo y Vivienda** de la norma. El grupo **Empresa queda fuera de alcance** — es "otro tipo de escalabilidad" (decisión del equipo, no de la norma). Empresa se documenta abajo solo como nota de exclusión, no se transcribe completo; el PDF original lo tiene íntegro si hace falta después.
>
> **Fuente:** [NCB-022.pdf — sitio oficial de la Superintendencia del Sistema Financiero](https://ssf.gob.sv/wp-content/uploads/ssf2018/Normas_Contables_Bancos/2020/NCB-022.pdf). Aprobación: 26/10/2005. Vigencia: 01/01/2007. Última modificación registrada en el texto: reforma (13), Sesión CN-04/2021 del 29/03/2021.

---

## PARTE A — Texto oficial (Capítulos I a VII)

### CDSSF-45/2005 — NORMAS PARA CLASIFICAR LOS ACTIVOS DE RIESGO CREDITICIO Y CONSTITUIR LAS RESERVAS DE SANEAMIENTO

*El Consejo Directivo de la Superintendencia del Sistema Financiero, con base a la potestad contenida en el artículo 10 de su Ley Orgánica y el tercer inciso del artículo 224 de la Ley de Bancos, emite las presentes Normas.*

#### CAPÍTULO I — OBJETO Y SUJETOS

**Objeto — Art. 1.-** Las presentes Normas tienen por objeto regular la evaluación y clasificación de los activos de riesgo crediticio según la calidad de los deudores y exigir la constitución de reservas mínimas de saneamiento de acuerdo a las pérdidas esperadas de los respectivos activos.

**Sujetos — Art. 2.-** Los sujetos obligados al cumplimiento de las presentes Normas son los que por Ley están bajo la supervisión de la Superintendencia del Sistema Financiero. También estarán sujetas las entidades que, estando bajo la competencia de otra superintendencia, integren un conglomerado financiero y posean activos de riesgo crediticio; así como las subsidiarias del conglomerado financiero.

**Art. 3.-** La Junta Directiva u órgano equivalente de los sujetos obligados será la responsable de velar por que se dé cumplimiento a estas Normas, de autorizar las políticas internas de concesión de créditos y del establecimiento de controles internos suficientes para garantizar su cumplimiento. Dichas políticas deben recoger al menos los elementos indicados en el Anexo 1 y deberán ser comunicadas a la Superintendencia en un plazo no mayor a diez días hábiles después de aprobadas.

Los sujetos obligados deberán establecer en sus políticas internas de concesión de créditos, mecanismos de originación expeditos, basados en simplificación de requisitos y trámites, para los créditos destinados a actividades productivas a los que hace referencia la Ley Especial para Facilitar el Acceso al Crédito (LEFAC).

#### CAPÍTULO II — ACTIVOS DE RIESGO CREDITICIO

**Art. 4.-** Se consideran como activos de riesgo crediticio todas las operaciones que signifiquen financiamientos directos o indirectos a favor de personas naturales, jurídicas o grupos de personas: préstamos, descuentos, pagos por cuenta ajena, intereses y otros productos por cobrar, otras cuentas por cobrar, otros créditos no clasificados, operaciones de arrendamiento financiero, créditos contingentes, préstamos con garantía de pólizas de seguro (por los montos que excedan las reservas matemáticas), desembolsos previos a la honra de una fianza, préstamos vencidos provenientes de fianzas honradas, y el monto avalado/afianzado por sociedades de garantía recíproca.

En esta Norma, "créditos" debe entenderse como "activos de riesgo crediticio".

#### CAPÍTULO III — AGRUPACIÓN DE LOS ACTIVOS DE RIESGO CREDITICIO

**Art. 5.-** Para evaluar y clasificar los activos de riesgo crediticio, los mismos **se agruparán separadamente en créditos para empresas, créditos para vivienda y créditos para consumo.**

**Créditos para empresas — Art. 6.-** *(Fuera de alcance del proyecto — ver nota de exclusión más abajo.)* Se agrupan aquí la generalidad de los créditos, con excepción de vivienda y consumo, incluyendo los otorgados al Gobierno Central, Municipalidades e Instituciones Oficiales Autónomas y Semi-Autónomas, y los créditos a los que hace referencia la LEFAC.

**Créditos para vivienda — Art. 7.-** Se agrupan dentro de los créditos para vivienda los préstamos otorgados a personas naturales para la adquisición de vivienda, así como los otorgados para adquisición de terreno, construcción, remodelación y reparación de viviendas. Generalmente reúnen estas características:
1. Los inmuebles son para uso del adquirente;
2. Se otorgan a largo plazo;
3. Son pagaderos en cuotas periódicas; y
4. Podrán estar garantizados con primera hipoteca o con segunda hipoteca (si ambas se constituyeron con la misma entidad), o con el Fideicomiso de Garantía para la Adquisición de Inmuebles administrado por el Banco Multisectorial de Inversiones.

> **Nota crítica de aplicación:** lo que define el grupo "Vivienda" es el **propósito del crédito** (adquirir/construir/remodelar una vivienda para uso del adquirente) — **no el tipo de garantía**. Un crédito con garantía hipotecaria cuyo objeto sea otro (por ejemplo, consolidar deudas) **no** es del grupo Vivienda; es Consumo. Ver la Parte D de este documento, producto "Crédito Personal con Garantía Hipotecaria".

**Créditos para consumo — Art. 8.-** Se agrupan dentro de los créditos para consumo los préstamos personales cuyo objeto es financiar la adquisición de bienes de consumo o el pago de servicios, con estas características generales:
1. El deudor es una persona natural;
2. El plazo del préstamo es generalmente entre uno y seis años; y
3. El pago se efectúa en cuotas periódicas, normalmente iguales y sucesivas.

**Se considerarán además como créditos para consumo, los financiamientos a personas naturales provenientes de la utilización de tarjetas de crédito.**

#### CAPÍTULO IV — EVALUACIÓN Y CLASIFICACIÓN DE LOS ACTIVOS DE RIESGO CREDITICIO

**Art. 9.-** Los sujetos obligados deberán tener debidamente clasificado, en todo momento, el 100% de los activos de riesgo crediticio.

**Los sujetos obligados, para determinar la clasificación de un deudor, reunirán todas las operaciones crediticias contratadas por el deudor con dicha entidad, de modo tal que la categoría de riesgo que se le asigne sea la que corresponde al crédito con mayor riesgo de recuperación.**

La Superintendencia podrá requerir que un sujeto obligado le asigne a un deudor la categoría de otro deudor, cuando existan criterios fundados que hagan presumir que entre ambos existen vinculaciones de propiedad, administración o negocio.

> **Nota de aplicación (interpretación del equipo, no cita literal):** esta regla de "todas las operaciones... la de mayor riesgo" se lee junto al Art. 5 (agrupación separada) y al hecho de que Empresa usa una metodología de evaluación totalmente distinta (Anexo 3, cualitativa) a la de Vivienda/Consumo (Anexo 1, solo días de mora). La lectura consistente es que la consolidación del Art. 9 opera **dentro de cada grupo** — ej.: si un cliente tiene dos tarjetas de crédito, su categoría de Consumo es la peor de las dos. No hay una fórmula en la norma para combinar una categoría de Empresa con una de Consumo/Vivienda en una sola cifra.

**Créditos para empresas (Art. 10-13) — Fuera de alcance.** Definen la metodología de evaluación cualitativa (Anexo 3), la periodicidad de evaluación de los 50 mayores deudores, y los requisitos de expediente (Anexo 2, umbral en $350,000). No se transcriben aquí por estar fuera del alcance del proyecto.

**Tratamiento de las garantías — Art. 14.-** Para la exigencia de reservas de saneamiento, el riesgo de un deudor se determina restando del saldo total de las obligaciones el valor de las garantías que lo respalden (según el Art. 15). Cuando una misma garantía respalde créditos a diferentes deudores, su valor se prorratea según los saldos adeudados.

**Art. 15.-** Tabla de garantías reconocidas y porcentaje a considerar (relevante para Vivienda, ya que Consumo normalmente no tiene garantía real):

| Tipo de garantía | % a considerar |
|---|---|
| Depósitos en efectivo | 100% |
| Certificados de depósito pignorados (bancos locales o extranjeros de primera línea) | 100% |
| Avales y fianzas de bancos locales o extranjeros de primera línea | 100% |
| Avales y fianzas por fondos administrados por el Banco Multisectorial de Inversiones | 100% |
| Prendas sobre valores de renta fija de "grado de inversión" | 100% |
| Garantías del Fideicomiso FORDEH | 100% |
| Garantía de fideicomisos donde el fiduciario sea el BMI | 100% |
| Bonos de prenda de Almacenes Generales de Depósito | 70% |
| **Primeras hipotecas sobre inmuebles**, debidamente inscritas | según rango de categoría: **A2 a C2 → 70% · D1 y D2 → 60% · E → 50%** |

**Art. 16.-** Requisitos de valoración de garantías hipotecarias: valuación por perito independiente obligatoria si el saldo total es ≥$75,000 en créditos de vivienda (≥$200,000 en empresa); la valoración no puede tener más de 36 meses (empresa) o 48 meses (vivienda) de antigüedad. No se consideran para reservas las garantías otorgadas por personas relacionadas al sujeto obligado para cubrir riesgos de terceros.

**Clasificación de créditos para vivienda y consumo — Art. 17.-** La totalidad de créditos para vivienda y consumo se evaluarán y clasificarán **mensualmente**, según el comportamiento de pago del deudor (sus saldos en mora), en la forma que dispone el Anexo 1, considerando el tratamiento de garantías de los Art. 14-16.

#### CAPÍTULO V — CONSTITUCIÓN DE RESERVAS DE SANEAMIENTO

**Categorías de riesgo — Art. 18.-** Los sujetos obligados deberán constituir a sus activos de riesgo crediticio las reservas mínimas de saneamiento, restando al saldo de cada deudor el valor de sus garantías (Art. 14-16), clasificando a los deudores y aplicando los siguientes porcentajes:

| Clasificación | Categoría | % de reserva |
|---|---|---|
| Normales | A1 | 0% |
| Normales | A2 | 1% |
| Subnormales | B | 5% |
| Deficientes | C1 | 15% |
| Deficientes | C2 | 25% |
| De difícil recuperación | D1 | 50% |
| De difícil recuperación | D2 | 75% |
| Irrecuperables | E | 100% |

**Reestructuraciones y refinanciamientos de deudas**

**Art. 19.-** *Prórroga:* prolongación del plazo de pago sin nuevo documento contractual ni cambio de referencia. *Crédito reprogramado:* modificación de las condiciones de amortización, con o sin cambio de plazo, sin nuevo documento. Ambos, junto a cualquier arreglo que modifique las condiciones originalmente pactadas, se denominan **créditos reestructurados**. Se exceptúa el ajuste de tasa por condiciones macroeconómicas no atribuibles al deudor (la entidad puede entonces modificar el plazo para mantener la cuota).

**Art. 20.-** *Crédito refinanciado:* aquel que cancela total o parcialmente otros créditos con problemas de mora o de capacidad de pago, cambiando sus condiciones.

Los deudores con créditos reestructurados o refinanciados **conservan su categoría de riesgo** solo si el deudor satisface por sus propios medios, antes de la reestructuración/refinanciamiento, la totalidad de los intereses adeudados a la fecha (sin que provengan de nuevo financiamiento). **Quienes no cumplan esta condición serán clasificados en la categoría C2 o una de mayor riesgo**, según los síntomas.

Si la operación reestructurada/refinanciada que no pagó la totalidad de intereses **continúa con atrasos**, será clasificada como **D1 o mayor riesgo**, salvo que:
- (para vivienda o consumo) no hayan transcurrido **6 meses** del nuevo plazo pactado.

**Reclasificación a categoría de menor riesgo — Art. 22.-** Para vivienda y consumo, un crédito reestructurado/refinanciado puede volver a una categoría de menor riesgo únicamente **hasta que el deudor demuestre normalidad en sus pagos de capital e intereses durante los últimos 6 meses**. "Normalidad" = atraso no mayor a 7 días calendario.

**Consolidación de deudas — Art. 23.-** Créditos otorgados para pagar obligaciones que el cliente tiene con la misma entidad u otra del sistema financiero, para aprovechar mejores condiciones de mercado. Si uno o más de los créditos a consolidar fueron otorgados por la misma entidad y presentan mora mayor a 30 días en los últimos 90 días, la consolidación **se considera refinanciamiento** (aplican las reglas del Art. 20-22, no un crédito nuevo limpio).

**Art. 24-26.-** Los créditos reestructurados/refinanciados deben quedar identificados en la contabilidad y sistemas de la entidad, permitiendo el seguimiento de su comportamiento de pago. La Superintendencia puede exigir reservas adicionales si hay intereses no percibidos y no provisionados. Toda reestructuración/refinanciamiento del mes debe informarse a la Superintendencia dentro de los primeros 7 días hábiles siguientes (10 días hábiles en marzo/junio/septiembre/diciembre).

**Reclasificaciones — Art. 27-29.-** La clasificación puede variar mes a mes por otorgamiento/pago de créditos, activos extraordinarios, castigo de créditos, reclasificación de deudores, etc.; los ajustes se hacen al cierre de cada mes. Toda reclasificación a categoría de **menor** riesgo de los 50 mayores deudores debe informarse a la Superintendencia con su justificación. Si la Superintendencia determina que un deudor está mal clasificado, ordena su reclasificación y el ajuste de reservas correspondiente.

**Información a la Superintendencia — Art. 30.-** Los sujetos obligados deben enviar mensualmente (primeros 7 días hábiles, 10 en marzo/junio/septiembre/diciembre) la clasificación completa de su cartera y las reservas de saneamiento correspondientes al cierre del mes.

#### CAPÍTULO VI — OTRAS DISPOSICIONES

**Art. 31.-** La Junta Directiva debe pronunciarse al menos una vez al año (con motivo del cierre del ejercicio) sobre la suficiencia de las reservas constituidas, dejando constancia en actas.

**Art. 32.-** Los auditores externos deben documentar el cumplimiento de las políticas internas de crédito e informarlo a la Superintendencia dentro de los primeros 60 días de cada año (o 10 días hábiles si detectan incumplimiento).

**Art. 33-34.-** Las entidades que otorguen créditos con garantía de una Sociedad de Garantía Recíproca no evalúan ni reservan por esos créditos (sin relajar sus controles de otorgamiento). Las Sociedades de Garantía Recíproca tienen 60 días para honrar su garantía tras el reclamo, tras lo cual el deudor recibe la categoría que corresponda a su tiempo de mora real.

**Art. 35.-** Los casos especiales y lo no contemplado en la norma lo resuelve el Consejo Directivo de la Superintendencia.

#### CAPÍTULO VII — VIGENCIA Y DISPOSICIONES TRANSITORIAS

**Art. 36.-** Vigente desde el 1 de enero de 2007; deroga el reglamento anterior de 1993.

**Art. 37-38.-** Las políticas del Art. 3 debían remitirse dentro de los primeros 90 días de vigencia. Los efectos fiscales se coordinan con la Dirección General de Impuestos Internos.

**Art. 39.-** Disposiciones transitorias sobre valuación de garantías hipotecarias (empresa y vivienda): valúos con antigüedad no mayor a 48 meses; peritos independientes obligatorios para garantías de empresa ≥$200,000 o de vivienda ≥$75,000; 24 meses de plazo para actualizar valúos desde la vigencia de la norma.

**Modificaciones registradas:** 13 reformas entre 2006 y 2021 (sesiones CD-07/06, CD-30/06, CD-49/06, CD-03/07, CD-36/09, CD-32/10, y CN-10/2012, CN-05/2013, CN-02/2014, CN-03/2014, CN-06/2014, CN-02/2015, CN-13/2020, CN-04/2021 del Comité de Normas del Banco Central de Reserva).

---

## PARTE B — Anexo 1 completo: criterios de clasificación (Vivienda y Consumo)

**Numeral 1-3.-** Cada entidad establece sus propias políticas, métodos y procedimientos de concesión, estudio y clasificación de créditos, aprobados por su Junta Directiva, homogéneos dentro de un mismo conglomerado. Deben detallar criterios de concesión, política de precios, responsabilidades, documentación mínima, criterios de clasificación por riesgo, y parámetros de los ratios financieros. La evaluación de riesgo debe ser independiente de quien otorgó el crédito. La Junta Directiva no debe retrasar la reclasificación a mayor riesgo ni la constitución de reservas cuando se aprecie deterioro.

**Numeral 4.-** En sobregiros y saldos deudores a la vista (relevante para **Sobregiro Elite**), el plazo para computar la antigüedad de los importes impagados se cuenta **desde el primer requerimiento de reembolso**, o desde la primera liquidación de intereses impagada.

**Numeral 5.-** La Junta Directiva establece políticas para líneas de crédito rotativas (relevante para **Adelanto de Salario, Sobregiro Elite, tarjetas de crédito**); si los desembolsos se usan fuera del destino pactado, el deudor se clasifica en categoría D.

**Numeral 6.-** En operaciones con cuotas de amortización periódica, la fecha del primer vencimiento para efectos de clasificación es la de la **cuota más antigua que aún tenga saldo impagado**.

**Numeral 9 — La tabla central para este proyecto:**

> *"La clasificación de los saldos y reservas de estos créditos se hará sobre la base de la antigüedad de la mora observada de las cuotas, según el siguiente esquema:"*

| Categoría | Mora — Vivienda | Mora — **Consumo** |
|---|---|---|
| A1 | Hasta 7 días | **Hasta 7 días** |
| A2 | Hasta 30 días | **Hasta 30 días** |
| B | Hasta 90 días | **Hasta 60 días** |
| C1 | Hasta 120 días | **Hasta 90 días** |
| C2 | Hasta 180 días | **Hasta 120 días** |
| D1 | Hasta 270 días | **Hasta 150 días** |
| D2 | Hasta 360 días | **Hasta 180 días** |
| E | +360 días | **+180 días** |

---

## PARTE C — Nota de exclusión: Anexo 2 y Anexo 3 (Empresa)

Por decisión del equipo, **el grupo Empresa no forma parte del alcance de este proyecto** (es "otro tipo de escalabilidad" — ningún personaje de la investigación tiene un crédito de negocio). En consecuencia:

- **Anexo 2** ("Expediente de los créditos para empresas") — no se transcribe. Define la documentación mínima (solicitud, contrato, estudio de viabilidad, estados financieros, flujo de caja proyectado, etc.) que exige un crédito empresarial. Irrelevante para Consumo/Vivienda.
- **Anexo 3** ("Criterios para la evaluación y clasificación de deudores de créditos para empresa") — no se transcribe. Define una tabla cualitativa multi-criterio (rentabilidad, liquidez, endeudamiento, flujo de caja, documentación) con "criterio básico" (uno determina la categoría) y "criterio secundario" (tres o más). Es una metodología completamente distinta a la de Vivienda/Consumo y no aplica a ningún producto de este documento.

Si en algún momento el equipo agrega un personaje con crédito de negocio (ej. una ampliación del caso de Rosa Hernández, dueña de tienda), el texto completo de ambos anexos está en el [PDF oficial](https://ssf.gob.sv/wp-content/uploads/ssf2018/Normas_Contables_Bancos/2020/NCB-022.pdf).

---

## PARTE D — Reglas de producto: la referencia operativa del agente (solo Consumo y Vivienda)

Formato: cada producto tiene su **grupo NCB-022** (determina qué tabla de días-mora usar), su **condición de estado** (bloqueo binario — si no se cumple, el producto no existe para ese cliente) y sus **parámetros** (umbrales numéricos a verificar). Esto es lo que `consultarOpcionesValidas(clienteId)` debe evaluar antes de que el agente mencione cualquier producto.

### Grupo: CONSUMO (tabla de días-mora: hasta 7 / 30 / 60 / 90 / 120 / 150 / 180+)

**Recordatorio / confirmación de pago**
- Condición de estado: ninguna.
- Parámetros: ninguno.

**Mover fecha de pago a la quincena**
- Condición de estado: obligación activa.
- Parámetros: `dia_pago` actual desalineado con `dia_ingreso_1`/`dia_ingreso_2` del cliente.

**Abono parcial que evita la mora**
- Condición de estado: obligación activa.
- Parámetros: debe existir un monto disponible del cliente suficiente para mantener (o recuperar) la categoría A1/A2 antes del cierre del mes — es decir, que el abono deje los días de mora de la cuota más antigua dentro del umbral de la categoría objetivo.

**Activar débito automático**
- Condición de estado: `tiene_debito_automatico == false`.
- Parámetros: ninguno adicional.

**Dividir la cuota en 2 pagos quincenales**
- Condición de estado: obligación activa, no definida oficialmente por Bancoagrícola en fuentes públicas — tratar como política interna a confirmar con el banco.

**Adelanto de Salario**
- Condición de estado: **cliente planillero** — salario o pensión depositado directamente en Bancoagrícola. Si no, el producto **no existe** para ese cliente.
- Parámetros: asalariado → ≥6 meses continuos en la empresa actual + ingreso líquido ≥$136/mes. Pensionado → ≥2 meses de depósitos + ingreso ≥$74/mes. Edad ≥21 años.
- Categoría NCB-022 mínima implícita: al ser crédito revolvente evaluado mensualmente, requiere estar en categoría normal (A1/A2) para mantener el límite vigente — un cliente ya en mora en este producto ve reducido o suspendido su límite en la reevaluación mensual.

**Extrafinanciamiento**
- Condición de estado: **la tarjeta de crédito asociada debe estar activa, SIN MORA ni sobregiro** (equivalente a categoría A1, 0 días de mora, en esa tarjeta específica). Si hay cualquier mora → producto **no disponible**.
- Parámetros: ingreso ≥$350/mes; edad + plazo ≤ 55/65/70 años según categoría laboral; 3-24 meses de antigüedad laboral.

**Sobregiro Elite**
- Condición de estado: cliente debe tener Cuenta Corriente Óptima (Clásica/Dorada/Platino) **activa**. Nivel Preferencial requiere además Cuenta Preferencial Elite.
- Parámetros: ingreso >$1,000/mes (Elite) o >$2,000/mes (Preferencial); edad ≥21; DUI vigente; constancia salarial ≤1 mes de antigüedad. Sujeto a estudio de crédito — en la práctica exige categoría NCB-022 favorable (no está documentado un umbral exacto públicamente; tratar como A1/A2 hasta confirmar con el banco).

**Crédito Personal con Orden de Descuento**
- Condición de estado: asalariado con descuento de planilla habilitado.
- Parámetros: ingreso suficiente vs. cuota (DTI).

**Crédito Personal con Cargo a Cuenta**
- Condición de estado: cuenta bancaria activa en Bancoagrícola.
- Parámetros: ingreso suficiente vs. cuota (DTI).

**Crédito Personal con Garantía Hipotecaria** ⚠️ es Consumo, no Vivienda (ver nota del Art. 7 arriba)
- Condición de estado: cliente debe aportar un inmueble como garantía; producto orientado a consolidar deudas existentes.
- Parámetros: no publicados en detalle — tratar como sujeto a estudio de crédito estándar.

**Tarjetas de crédito (Clásica, Clásica Total, Black; Dorada sin confirmar)**
- Condición de estado: ninguna especial más allá de estudio de crédito aprobado.
- Parámetros: ingreso mínimo — Clásica VISA $350, Clásica Total $300, Black $2,600. Edad ≥18.

**Crédito para Vehículos**
- Condición de estado: ninguna especial.
- Parámetros: edad ≥21; hasta $45,000/72 meses o $36,000/60 meses; financia 90% (nuevo) u 85% (usado, ≤3 años de antigüedad); asalariado, independiente, pensionado o rentista.

**Reestructura / readecuación**
- Condición de estado: **disponible incluso con mora** — es el único escalón sin bloqueo de estado. Pero al reestructurar, el crédito queda forzado a categoría **C2 o peor** si no se pagan primero la totalidad de los intereses adeudados (Art. 20), y a **D1 o peor** si sigue con atrasos tras la reestructura (salvo margen de 6 meses).
- Parámetros: para volver a categoría de menor riesgo, exige 6 meses de normalidad de pago (atraso ≤7 días) tras la reestructura (Art. 22).

**Pase a asesor humano**
- Condición de estado: ninguna, siempre disponible.

### Grupo: VIVIENDA (tabla de días-mora: hasta 7 / 30 / 90 / 120 / 180 / 270 / 360+ — el doble de laxa que Consumo)

**Crédito Hipotecario para Compra de Vivienda / "Mi Casa Bancoagrícola"**
- Condición de estado: propósito debe ser adquisición/construcción/remodelación de vivienda para uso del adquirente (si no, es Consumo, no Vivienda — ver nota Art. 7).
- Parámetros: ingreso mínimo $1,250/mes (o combinado si es mancomunado); plazo hasta 30 años; financia hasta 95% del valor; asalariado, independiente o salvadoreño en el exterior.
- Reservas: sobre esta categoría aplica además el descuento de garantía hipotecaria del Art. 15 (70% de su valor si está en categorías A2-C2, 60% en D1/D2, 50% en E) antes de calcular la reserva.

---

## Resumen para quien solo necesita la regla, no la norma completa

```
SI producto == "Extrafinanciamiento" Y dias_mora_tarjeta_asociada > 0     → NO OFRECER
SI producto == "Adelanto de Salario" Y cliente.planillero == false        → NO OFRECER
SI producto == "Sobregiro Elite" Y cliente.tiene_cuenta_optima == false   → NO OFRECER
SI producto == "Sobregiro Elite" Y cliente.ingreso <= 1000                → NO OFRECER
SI producto == "Reestructura"                                            → SIEMPRE DISPONIBLE (pero fuerza categoría ≥C2)
SI producto == "Crédito Hipotecario Vivienda" Y propósito != adquirir/construir/remodelar vivienda → ES CONSUMO, NO VIVIENDA
categoria_riesgo(dias_mora, grupo) = buscar en tabla de Vivienda o Consumo según corresponda (Parte B) — NUNCA usar la tabla de Empresa
```

### Fuente única de este documento
[NCB-022.pdf — Superintendencia del Sistema Financiero de El Salvador](https://ssf.gob.sv/wp-content/uploads/ssf2018/Normas_Contables_Bancos/2020/NCB-022.pdf)
