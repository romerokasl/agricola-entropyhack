# Productos con pago y NCB-022 — lo que el agente necesita para no alucinar

> **⚠️ Decisión de alcance del equipo:** este proyecto solo trabaja con los grupos **Consumo y Vivienda** de NCB-022. **Empresa queda fuera de alcance** (otra metodología, "otro tipo de escalabilidad"). La Parte 4 de abajo describe el catálogo de Empresa solo como referencia informativa — no hace falta implementarlo.
>
> **Este documento es el análisis y el "por qué".** Para la referencia operativa que debe consultar el agente (texto completo de la norma + reglas de cada producto en formato de chequeo), ver [`04-ncb022-norma-completa.md`](04-ncb022-norma-completa.md).

> **Para qué sirve este documento:** el agente va a ofrecer productos reales y va a hablar de "categoría de riesgo" y "reservas" en el pitch. Si cualquiera de los dos datos está mal — le ofrece Extrafinanciamiento a alguien que no califica, o dice que evitar la mora "le ahorra plata al banco" sin poder decir cuánto — es exactamente el tipo de error que el ingeniero de IA del banco (Alejandro) va a cachar en una pregunta. Este documento junta dos investigaciones para que `consultarOpcionesValidas(clienteId)` y el dashboard tengan una base real, no inventada:
>
> 1. **Parte 1** — condiciones de elegibilidad exactas de cada producto de la escalera (`01-reglas-del-agente.md` §2), sacadas de las páginas oficiales de Bancoagrícola.
> 2. **Parte 2** — la norma NCB-022 completa (la recomendó el banco tenerla en cuenta), sacada del PDF oficial de la SSF, no de resúmenes de terceros.
> 3. **Parte 3** — cómo se usan las dos juntas en el código del agente y en el dashboard.
> 4. **Parte 4** — qué pasa con vivienda y empresa (la norma NO los trata igual que consumo), y el catálogo completo de productos de Bancoagrícola por grupo — para responder "¿son todas las categorías?" y "¿qué otros productos puede tener un cliente?".

---

## Parte 1 — Elegibilidad exacta de cada producto con pago

Cada fila es un producto real de Bancoagrícola. "Condición de estado" es un bloqueo binario (o lo cumple o no existe el producto para ese cliente); "parámetro numérico" es lo que además hay que verificar.

### Escalón 1-4 de la escalera (costo ~$0, no son productos de catálogo)

| Escalón | Qué es | Condición de estado | Fuente |
|---|---|---|---|
| Recordatorio / confirmación | Aviso, no un producto | Ninguna | interno |
| Mover fecha de pago a la quincena | Cambio de día de corte/pago | Cuenta u obligación activa | interno |
| Abono parcial que evita la mora | Pago parcial | Cuenta activa, debe existir un monto que "salve" la categoría (ver Parte 2) | interno |
| Activar débito automático | Cargo automático | No tenerlo ya activo | `tiene_debito_automatico` en `CREDIT_OBLIGATION` |

### Escalón 5-7: productos reales con condiciones de elegibilidad propias

**Adelanto de Salario** ([bancoagricola.com/adelanto-de-salario](https://www.bancoagricola.com/adelanto-de-salario))
- **Condición de estado bloqueante:** exclusivo para clientes **planilleros** — el salario o la pensión debe depositarse **directamente en Bancoagrícola**. Un cliente independiente, o cuyo empleador paga por otro banco, no tiene este producto disponible, sin excepción.
- Parámetros: asalariado ≥6 meses continuos en la empresa actual + ingreso líquido ≥$136/mes · pensionado ≥2 meses de depósitos + ingreso ≥$74/mes · edad ≥21 años · salvadoreño o extranjero residente.
- Es crédito revolvente, plazo de 1 año prorrogable, se paga solo (débito automático al recibir el salario/pensión). El límite se reevalúa mensualmente.
- No requiere trámite ni documentos — se contrata desde banca móvil, e-banca, cajero o kiosko.

**Extrafinanciamiento** ([bancoagricola.com/extrafinanciamiento](https://www.bancoagricola.com/extrafinanciamiento))
- **Condición de estado bloqueante:** ⚠️ la tarjeta de crédito asociada debe estar **activa, SIN MORA ni sobregiro**. Si el cliente ya está atrasado en esa tarjeta — el caso que el agente está gestionando — el producto queda descalificado automáticamente.
- Parámetros: ingreso ≥$350/mes · edad + plazo del crédito no debe exceder 55 años (mujeres sector privado), 65 (hombres sector privado) o 55 (sector gobierno); hasta 70 años para independientes/rentistas · 3 a 24 meses de antigüedad laboral según actividad.
- Aplica con o sin experiencia crediticia previa, sin fiador. La cuota es independiente del pago de la tarjeta. Desembolso inmediato tras aprobación, 100% del monto autorizado disponible al instante.

**Sobregiro Elite** ([bancoagricola.com/sobregiro-elite](https://www.bancoagricola.com/sobregiro-elite))
- **Condición de estado bloqueante:** requiere tener una **Cuenta Corriente Óptima (Clásica, Dorada o Platino) activa**. Sin esa cuenta, el producto no existe para ese cliente. El nivel Preferencial exige además Cuenta Corriente Preferencial Elite.
- Parámetros: ingreso >$1,000/mes (Elite estándar) o >$2,000/mes (Preferencial) · edad ≥21 años · DUI vigente o carné de residente · constancia salarial con máximo 1 mes de antigüedad.
- Línea rotativa de $500 a $25,000, sujeta a estudio de crédito, plazo de hasta 1 año para el pago del capital. La página oficial no menciona explícitamente que descalifique por mora existente (a diferencia de Extrafinanciamiento) — pero sí está "sujeta a estudio de crédito y políticas de Bancoagrícola", que en la práctica evalúa la categoría NCB-022 del cliente (Parte 2).

**Crédito Personal** ([bancoagricola.com/creditos-personas](https://www.bancoagricola.com/creditos-personas)) — tres variantes con condición de estado distinta cada una:
- *Con Orden de Descuento*: exige ser asalariado con descuento de planilla habilitado.
- *Con Cargo a Cuenta*: exige cuenta bancaria activa en Bancoagrícola para el débito.
- *Con Garantía Hipotecaria*: exige un inmueble como garantía; pensado para consolidar deudas.

### Escalón 6 (tarjetas, para contexto de reemplazo/upgrade, no para negociación de mora)

| Tarjeta | Ingreso mínimo | Otros | Fuente |
|---|---|---|---|
| Clásica VISA | $350/mes | Sin cuota de manejo, edad ≥18 | [bancoagricola.com/tarjeta-credito-clasica-visa](https://www.bancoagricola.com/tarjeta-credito-clasica-visa) |
| Clásica Total | $300/mes | — | búsqueda pública |
| Black Mastercard | $2,600/mes | Primer año gratis, luego $200/año | [bancoagricola.com/tarjeta-credito-black-mastercard](https://www.bancoagricola.com/tarjeta-credito-black-mastercard) |
| Dorada | No confirmado — la página no devolvió contenido extraíble en esta investigación | — | pendiente de verificar directamente |

### Escalón 7-8

**Reestructura / readecuación** — a diferencia de los productos anteriores, **sí está disponible incluso con mora** (es justamente para eso). Su condición real no es de elegibilidad comercial sino de la norma NCB-022: ver Parte 2, Art. 19-22 (reestructuraciones y refinanciamientos).

**Pase a asesor humano** — sin condición, siempre disponible.

### El hallazgo que hay que corregir en el agente

`01-reglas-del-agente.md` describe Extrafinanciamiento como opción para "cuando el cliente necesita liquidez puntual" sin mencionar la condición de "sin mora". Un cliente ya atrasado en esa tarjeta — que es el escenario típico de esta conversación — **no puede recibir ese producto**, y ofrecérselo sería el guardrail #5 violado ("nunca ofrezcas un producto que no esté en la lista de opciones válidas"). `consultarOpcionesValidas(clienteId)` tiene que devolver esto como una regla evaluada en tiempo real, no como una lista fija.

---

## Parte 2 — NCB-022, desglosada del documento oficial

**Nombre completo:** *Normas para Clasificar los Activos de Riesgo Crediticio y Constituir las Reservas de Saneamiento*
**Emite:** Consejo Directivo de la Superintendencia del Sistema Financiero (SSF), con base en su Ley Orgánica y el Art. 224 de la Ley de Bancos.
**Aprobación:** 26/10/2005 · **Vigencia:** 01/01/2007 · con al menos 13 reformas posteriores (marcadas como notas (1) a (13) en el texto vigente).
**Fuente primaria:** [NCB-022.pdf — sitio oficial de la SSF](https://ssf.gob.sv/wp-content/uploads/ssf2018/Normas_Contables_Bancos/2020/NCB-022.pdf) (documento escaneado; extraído visualmente para este resumen, página por página).

### Objeto (Art. 1)

> *"Regular la evaluación y clasificación de los activos de riesgo crediticio según la calidad de los deudores y exigir la constitución de reservas mínimas de saneamiento de acuerdo a las pérdidas esperadas de los respectivos activos."*

En una frase: **le dice al banco cuánto dinero tiene que apartar (reservar) por cada crédito, según qué tan probable es que no se lo paguen** — y esa probabilidad se mide, para personas naturales, casi exclusivamente por **días de mora**.

### Quién debe cumplirla (Art. 2)

Todo sujeto bajo supervisión de la SSF — Bancoagrícola incluido — y cualquier entidad de su conglomerado financiero que tenga activos de riesgo crediticio.

### Qué cuenta como "activo de riesgo crediticio" (Art. 4)

Préstamos, descuentos, intereses por cobrar, arrendamiento financiero, créditos contingentes, y explícitamente los saldos de **tarjetas de crédito**.

### Los tres grupos de crédito (Art. 5-8)

1. **Créditos para empresas** (Art. 6) — todo lo que no sea vivienda o consumo. Tiene sus propios criterios cualitativos (Anexo 3), no aplica al proyecto.
2. **Créditos para vivienda** (Art. 7) — préstamos para adquisición/construcción de vivienda, garantizados con hipoteca, a largo plazo.
3. **Créditos para consumo** (Art. 8) — préstamos personales para bienes/servicios de consumo, deudor persona natural, plazo 1-6 años. **El artículo dice explícitamente: "Se considerarán además como créditos para consumo, los financiamientos a personas naturales provenientes de la utilización de tarjetas de crédito."** — es decir, Extrafinanciamiento, Adelanto de Salario, Sobregiro Elite, Crédito Personal y las tarjetas de crédito son todos **"consumo"** para efectos de esta norma. La columna que le importa al agente es siempre la de "Consumo", nunca la de "Vivienda".

### ⚠️ La regla que casi nadie cita: la clasificación es del deudor, no del producto (Art. 9)

> *"Los sujetos obligados para determinar la clasificación de un deudor, reunirán todas las operaciones crediticias contratadas por el deudor con dicha entidad, de modo tal que la categoría de riesgo que se le asigne sea la que corresponde al crédito con mayor riesgo de recuperación."*

Esto es importante y no está reflejado hoy en `UML.md`: **la categoría de riesgo no vive por producto — vive por cliente, y es la peor de todas sus obligaciones con el banco.** Si Karla está al día en su tarjeta pero 45 días atrasada en su préstamo personal, su categoría NCB-022 completa con Bancoagrícola es la que corresponde a 45 días (categoría B en consumo), no un promedio ni la de la tarjeta. Esto también explica, con más precisión técnica, por qué Extrafinanciamiento exige "tarjeta sin mora": si hay mora en cualquier producto, la categoría del cliente ya no es A1/A2, y el estudio de crédito del nuevo producto lo va a reflejar.

### La tabla de categorías y días de mora (Anexo 1, numeral 9) — la fuente de verdad

| Categoría | Vivienda | **Consumo** (la que aplica a este proyecto) |
|---|---|---|
| A1 | Hasta 7 días | **Hasta 7 días** |
| A2 | Hasta 30 días | **Hasta 30 días** |
| B | Hasta 90 días | **Hasta 60 días** |
| C1 | Hasta 120 días | **Hasta 90 días** |
| C2 | Hasta 180 días | **Hasta 120 días** |
| D1 | Hasta 270 días | **Hasta 150 días** |
| D2 | Hasta 360 días | **Hasta 180 días** |
| E | +360 días | **+180 días** |

Los días de mora se cuentan **desde la fecha de la cuota impagada más antigua que aún tenga saldo pendiente** (Anexo 1, numeral 6). Para sobregiros y saldos deudores a la vista (relevante para Sobregiro Elite), el conteo empieza desde el primer requerimiento de reembolso o la primera liquidación de intereses impagada (Anexo 1, numeral 4).

### La tabla de reservas por categoría (Art. 18) — lo que le cuesta al banco cada categoría

| Grupo | Categoría | % de reserva sobre el saldo (neto de garantías) |
|---|---|---|
| Normales | A1 | 0% |
| Normales | A2 | 1% |
| Subnormales | B | 5% |
| Deficientes | C1 | 15% |
| Deficientes | C2 | 25% |
| De difícil recuperación | D1 | 50% |
| De difícil recuperación | D2 | 75% |
| Irrecuperables | E | 100% |

Esta reserva se calcula sobre el saldo **después de restar el valor de las garantías** (Art. 14-16) — pero los productos de consumo de este proyecto (tarjetas, Extrafinanciamiento, Adelanto de Salario, Sobregiro Elite) son **sin garantía real**, así que en la práctica el saldo completo lleva el porcentaje de la tabla.

### Reestructuraciones y refinanciamientos (Art. 19-22) — el fundamento del escalón 7

- Un crédito **reestructurado o refinanciado** que no pague la totalidad de los intereses adeudados a la fecha de la reestructura queda clasificado en **C2 o peor**, según los síntomas (Art. 19).
- Si después de reestructurar el crédito sigue con atrasos, se clasifica en **D1 o peor** — salvo que no hayan pasado más de 6 meses del nuevo plazo pactado (créditos de vivienda/consumo), en cuyo caso se le da ese margen antes de forzar la baja categoría (Art. 20).
- Para volver a una categoría de menor riesgo tras una reestructura, el deudor de vivienda/consumo debe demostrar **normalidad en sus pagos de capital e intereses durante los últimos 6 meses** — "normalidad" se define como atraso no mayor a 7 días calendario (Art. 22).

**Esto es oro para el pitch:** justifica por qué el escalón 7 (reestructura) es el más caro y de última instancia — no es una preferencia de diseño, es que la norma **fuerza** una categoría C2 o peor en el momento de reestructurar, así que reestructurar demasiado pronto le cuesta reservas al banco aunque "ayude" al cliente. El escalón 2 (mover la fecha a la quincena), en cambio, si se hace **antes de que la cuota entre en mora**, mantiene al cliente en A1 (0% de reserva) — de ahí sale literalmente el argumento de "costo cero para el banco".

---

## Parte 3 — Cómo se usa esto en el proyecto

### 1. En `consultarCliente(clienteId)`

Debe devolver, además de saldo/cuota/fecha: `dias_mora_cuota_mas_antigua` (el dato crudo) y `categoria_riesgo_actual` calculada con la tabla de Consumo de arriba — **no como texto libre del LLM, como un cálculo determinista** (`if dias <= 7: return 'A1'`, etc.). Ya corregido en `UML.md`.

### 2. En `consultarOpcionesValidas(clienteId)`

Cada producto de la escalera debe evaluar su condición de estado real (Parte 1) contra el estado real del cliente, no ofrecerse por defecto:
```
Extrafinanciamiento disponible  ⟺  dias_mora_tarjeta == 0
Adelanto de Salario disponible  ⟺  cliente.tipo_ingreso == "planillero_bancoagricola"
Sobregiro Elite disponible      ⟺  cliente.tiene_cuenta_optima == true AND ingreso > 1000
Reestructura disponible         ⟺  siempre (es la única sin restricción de estado)
```

### 3. En el dashboard — la métrica "provisiones evitadas" (Nivel 3 de `02-decisiones-y-plan.md`)

Ahora sí es calculable con una fórmula real, no un número inventado:

```
reserva_evitada($) = saldo_cliente × (%reserva_categoría_sin_intervención − %reserva_categoría_con_intervención)
```

Ejemplo con el caso de Karla: si sin intervenir su cuota cae en mora y llega a 35 días (categoría B, 5% de reserva) y la intervención (mover la fecha a la quincena) la mantiene en A1 (0% de reserva) sobre un saldo de $400, el banco se ahorra reservar **$20** en ese único caso. Multiplicado por los 27,000 clientes de mora temprana que mencionó el banco, esto deja de ser una frase de pitch y se vuelve un número defendible.

### 4. Una distinción que no hay que confundir en el pitch

NCB-022 y "la ventana de los 10 días" (`00-contexto-global.md` §10, Ley de Regulación de los Servicios de Información sobre el Historial de Crédito) **son dos cosas distintas, con dos audiencias distintas**:

| | NCB-022 | Ventana de 10 días |
|---|---|---|
| Quién la exige | SSF, al banco | Ley, a los burós (Equifax, TransUnion, InfoRed) |
| Qué mide | Cuánto capital debe reservar el banco por ese cliente | Cuándo la mora se vuelve visible en el historial externo del cliente |
| A quién le importa | Al banco (ROI, capital regulatorio) | Al cliente (su récord crediticio) | 
| Argumento de pitch | "Evitar el deterioro de categoría libera reservas — ahí está el ROI del banco" | "Tu pago se reporta el día 10; tenés 4 días" — urgencia honesta hacia el cliente |

Ambas justifican por qué actuar rápido importa, pero por razones distintas — usarlas juntas está bien, pero no son la misma norma ni hay que fusionarlas en una sola explicación si el jurado pregunta por separado.

### Fuentes
- [NCB-022.pdf — Superintendencia del Sistema Financiero (texto oficial vigente)](https://ssf.gob.sv/wp-content/uploads/ssf2018/Normas_Contables_Bancos/2020/NCB-022.pdf)
- [Adelanto de Salario — Bancoagrícola](https://www.bancoagricola.com/adelanto-de-salario)
- [Extrafinanciamiento — Bancoagrícola](https://www.bancoagricola.com/extrafinanciamiento)
- [Sobregiro Elite — Bancoagrícola](https://www.bancoagricola.com/sobregiro-elite)
- [Créditos Bancoagrícola](https://www.bancoagricola.com/creditos-personas)
- [Tarjeta Clásica VISA — Bancoagrícola](https://www.bancoagricola.com/tarjeta-credito-clasica-visa)
- [Tarjeta Black Mastercard — Bancoagrícola](https://www.bancoagricola.com/tarjeta-credito-black-mastercard)

---

## Parte 4 — Vivienda y empresa: no se tratan igual que consumo, y el catálogo completo

### ¿Son "A1...E" las únicas categorías? Sí — pero la norma tiene solo 3 grupos, y cada uno se evalúa distinto

El Art. 5 de NCB-022 es explícito: *"los mismos se agruparán separadamente en créditos para empresas, créditos para vivienda y créditos para consumo."* **Son exactamente 3 grupos, ni más ni menos** — esa parte de la pregunta tiene respuesta cerrada. Lo que **no** es igual entre los tres es cómo se llega a la categoría A1-E:

| Grupo | Metodología | Fuente en la norma |
|---|---|---|
| **Consumo** | Pura antigüedad de mora de la cuota más atrasada, tabla fija (Parte 2 de este documento) | Art. 17 + Anexo 1, numeral 9 |
| **Vivienda** | Misma lógica (solo días de mora), pero con **umbrales casi el doble de laxos** que consumo | Art. 17 + Anexo 1, numeral 9 |
| **Empresa** | **Multi-criterio cualitativo** — mora es solo uno de varios factores, junto a rentabilidad, liquidez, flujo de caja, endeudamiento, destino de fondos y documentación | Art. 10 + Anexo 3 |

### Vivienda: mismos nombres de categoría, el doble de tiempo para llegar a cada una

| Categoría | Consumo | Vivienda |
|---|---|---|
| A1 | hasta 7 días | hasta 7 días |
| A2 | hasta 30 días | hasta 30 días |
| B | hasta 60 días | **hasta 90 días** |
| C1 | hasta 90 días | **hasta 120 días** |
| C2 | hasta 120 días | **hasta 180 días** |
| D1 | hasta 150 días | **hasta 270 días** |
| D2 | hasta 180 días | **hasta 360 días** |
| E | +180 días | **+360 días** |

Esto tiene sentido de negocio: una hipoteca tiene mejor garantía real (la casa) y cuotas más espaciadas, así que la norma le da más margen antes de forzar reservas altas.

### Empresa: la mora es un criterio más, no el único (Anexo 3)

Para clasificar un crédito de empresa, el banco evalúa contra una tabla con dos tipos de criterio:
- **Criterio Básico (CB):** basta que se cumpla UNO para determinar la categoría (excepto A1/A2, que exigen cumplir TODOS los básicos).
- **Criterio Secundario (CS):** hacen falta TRES O MÁS cumplidos para determinar la categoría.

Los factores evaluados: mora (con su propia tabla, ligeramente distinta a consumo — ver abajo), estructura del crédito vs. flujos del deudor, documentación completa según Anexo 2, destino de los fondos, rentabilidad, liquidez, nivel de endeudamiento, flujo de caja operacional, rotación de cuentas por cobrar/inventario, y para categoría E: causales de disolución legal, cese de operaciones, o crédito en cobranza judicial.

| Categoría | Mora (uno de los criterios, no el único) |
|---|---|
| A1 | mora no mayor a 14 días en los últimos 12 meses |
| A2 | atrasos de hasta 30 días |
| B | atrasos hasta 60 días |
| C1 | 61 a 90 días |
| C2 | 91 a 120 días |
| D1 | 121 a 150 días |
| D2 | 151 a 180 días |
| E | 181 días o más |

**Por qué esto importa para la pregunta de si Art. 9 mezcla categorías entre grupos:** dado que Empresa se evalúa con una tabla de criterios cualitativos que **no existe** para Vivienda/Consumo (rentabilidad, liquidez, flujo de caja no aplican a una tarjeta de crédito personal), no hay forma mecánica de "fusionar" una categoría de empresa con una de consumo en una sola — son sistemas de medición distintos. La lectura más consistente con el Art. 5 (agrupación separada) es que el Art. 9 ("todas las operaciones... la de mayor riesgo") consolida operaciones **dentro del mismo grupo**: si un cliente tiene dos tarjetas de crédito, su categoría de consumo es la peor de las dos; si además tiene un préstamo PYME, ese préstamo tiene su propia categoría de empresa, calculada aparte con el Anexo 3. **No encontré una frase que lo diga en esos términos exactos** — es la interpretación que se sostiene de leer el Art. 5 y el Anexo 3 juntos, no una cita textual, así que vale la pena confirmarlo con Alejandro si en el pitch preguntan por un cliente que tenga ambos tipos de crédito a la vez.

### El catálogo completo de productos de Bancoagrícola, por grupo NCB-022

**Consumo** (todo lo que ya vimos en la escalera, más lo nuevo encontrado):
- Tarjetas de crédito: Clásica VISA ($350/mes), Clásica Total ($300/mes), Black Mastercard ($2,600/mes), Dorada (no confirmado)
- Extrafinanciamiento, Adelanto de Salario, Sobregiro Elite
- Crédito Personal (Orden de Descuento / Cargo a Cuenta)
- **Crédito para Vehículos** — hasta $45,000, plazo hasta 72 meses (nuevo) o hasta $36,000/60 meses; financia 90% (nuevo) u 85% (usado, máx. 3 años de antigüedad); edad ≥21, asalariado/independiente/pensionado/rentista. ([bancoagricola.com/credito-para-vehiculos](https://www.bancoagricola.com/credito-para-vehiculos)) — es consumo porque el objeto es un bien de consumo del propio adquirente (Art. 8), no importa que el vehículo quede en garantía.
- Crédito de Estudio, Credicheque (mencionados en el catálogo general, sin ficha de requisitos pública detallada encontrada)

**Vivienda** (grupo aparte, propio, con su tabla de días más laxa):
- **Crédito Hipotecario para Compra de Vivienda / "Mi Casa Bancoagrícola"** — ingreso mínimo $1,250/mes (o combinado si es mancomunado), plazo hasta 30 años, financia hasta 95% del valor. Para asalariados, independientes o salvadoreños en el exterior. ([bancoagricola.com/credito-hipotecario-para-compra-de-vivienda](https://www.bancoagricola.com/credito-hipotecario-para-compra-de-vivienda))
- ⚠️ **Ojo con este:** "Crédito Personal con Garantía Hipotecaria" (ya listado en Parte 1) **NO es del grupo Vivienda** aunque use una hipoteca como garantía — su objeto es consolidar deudas personales, no adquirir/construir la vivienda. Por el Art. 7, lo que define el grupo es el **propósito del crédito**, no el tipo de garantía. Este producto es **Consumo**.

**Empresa** (ninguno de estos está en la escalera hoy — solo aplicaría si un personaje como Rosa Hernández, dueña de tienda, tuviera además un préstamo de negocio):
- Línea de Crédito Revolvente (capital de trabajo)
- Línea de Crédito Fija / Línea de Crédito Fija Supervisada (inversión, proyectos de construcción con desembolso por avance de obra)
- Crédito Automático / Back to Back (garantizado con depósito a plazo pignorado)
- Crédito Decreciente (formación de capital, activo fijo, expansión)
- Préstamo a Corto Plazo (capital de trabajo urgente, <1 año)
- Banca PYME: Capital de Trabajo, financiamiento de activo fijo (maquinaria, vehículos comerciales, instalaciones)

([bancoagricola.com/lineas-de-credito](https://www.bancoagricola.com/lineas-de-credito), [bancoagricola.com/pyme](https://www.bancoagricola.com/pyme))

### Qué significa esto para el diseño del agente

- **Ningún personaje actual de la investigación (`01-reglas-del-agente.md` §7) tiene un crédito de vivienda o de empresa** en su perfil descrito — todos son casos de tarjeta/consumo. Mientras eso siga así, el agente **no necesita** implementar la lógica de Anexo 3 ni la tabla de vivienda para el demo.
- Si el equipo decide agregar un personaje con hipoteca o negocio propio (le daría variedad al pitch), `consultarCliente` tendría que devolver **una categoría de riesgo por grupo de producto**, no una sola categoría global — y el cálculo de días-mora→categoría tendría que usar la tabla de Vivienda o el criterio cualitativo de Empresa según corresponda, nunca la tabla de Consumo.
- Para el alcance actual del hackathon, la tabla de Consumo (Parte 2) sigue siendo la única que el agente necesita calcular en tiempo real.

### Fuentes adicionales de esta parte
- [Crédito para Vehículos — Bancoagrícola](https://www.bancoagricola.com/credito-para-vehiculos)
- [Crédito Hipotecario para Compra de Vivienda — Bancoagrícola](https://www.bancoagricola.com/credito-hipotecario-para-compra-de-vivienda)
- [Líneas de Crédito — Bancoagrícola](https://www.bancoagricola.com/lineas-de-credito)
- [Banca PYME — Bancoagrícola](https://www.bancoagricola.com/pyme)
- [NCB-022.pdf, Anexo 3 — Superintendencia del Sistema Financiero](https://ssf.gob.sv/wp-content/uploads/ssf2018/Normas_Contables_Bancos/2020/NCB-022.pdf)
