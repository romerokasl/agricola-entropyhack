---
name: bancoagricola-ui
description: >-
  Guía de diseño, identidad visual de Bancoagrícola (Grupo Bancolombia), tokens de color,
  tipografía y directrices de experiencia de usuario empática para prevención de mora.
---

# Bancoagrícola Brand & Empathetic UX Guidelines

Esta habilidad contiene la identidad visual, paleta de colores y lineamientos de experiencia de usuario (UX) para el desarrollo del frontend de prevención de mora.

---

## 1. Identidad de Marca y Personalidad

* **Organización**: Banco Agrícola (El Salvador), parte de Grupo Bancolombia.
* **Propósito**: "Promover el desarrollo económico sostenible para lograr el bienestar de todos."
* **Tono de Voz**: Empático, cercano, claro, transparente y constructivo. Hablamos como un **aliado financiero**, nunca como una agencia de cobranza hostil.
* **Identidad Cultural**: Representa a los salvadoreños. La cercanía es **implícita** (cálida, respetuosa y comprensiva), **evitando mensajes patrióticos o slogans forzados**.

---

## 2. Paleta de Colores Oficial (Tailwind Tokens)

Extraídos de la paleta oficial (`colorize.design-bancoagricola.com-palette.css`) y adaptados para Tailwind:

| Token | Hex / Valor | Uso Principal |
| :--- | :--- | :--- |
| `bg-agricola-blue` | `#003B71` | Headers, barras superiores, botones primarios (CTAs), acentos corporativos |
| `bg-agricola-blue-hover` | `#002C55` | Hover en botones primarios |
| `bg-agricola-blue-light` | `#EBF3FA` | Fondos de banners de ayuda, chips de estado activo suave |
| `bg-agricola-yellow` | `#FDDA24` | Acentos de marca, cintas, botones secundarios destacados, alertas preventivas |
| `text-agricola-dark` | `#282828` | Texto principal (legibilidad alta sin la dureza del `#000`) |
| `text-agricola-dark-muted` | `#5F5D58` | Subtítulos, metadatos, labels secundarios |
| `bg-agricola-bg` | `#F8F8F8` | Fondo general de la aplicación (whitesmoke cálido) |
| `bg-agricola-bg-white` | `#FFFFFF` | Contenedores y tarjetas principales (Cards) |
| `border-agricola-border` | `#E2E6EA` | Bordes suaves de separación |

### Colores Semánticos para Salud Crediticia (Empatía Preventiva)
* **Saludable / Al día**: `#28A745` (Forest Green). Fondo suave: `#EAF7ED`.
* **Riesgo Preventivo / Atención Temprana**: `#E0A800` (Goldenrod). Fondo suave: `#FFF9E6`. Usar este estado para sugerir ajustes antes de que venza una cuota.
* **Acción Inmediata Requerida**: `#DC3545` (Crimson suave). Fondo suave: `#FDECEE`. **Importante:** Jamás usar palabras alarmistas como *"¡Estás en mora!"* o *"¡Cobro judicial!"*. Usar: *"Protejamos tu récord crediticio juntos"* o *"Tenemos opciones para aliviar tu cuota este mes"*.

---

## 3. Principios de Diseño UI

* **Uso Generoso del Espacio Negativo (White Space)**: Diseño limpio y despejado, inspirado en el rebranding moderno de Bancolombia.
* **Tarjetas (Cards)**:
  * Fondo blanco puro (`#FFFFFF`) sobre fondo `#F8F8F8`.
  * Bordes suaves (`border border-agricola-border`).
  * Sombras muy sutiles (`shadow-subtle: 0 2px 8px rgba(0, 0, 0, 0.04)`).
  * Radio de borde: `rounded-xl` (12px) para tarjetas, `rounded-lg` (8px) para botones.
* **Tipografía**:
  * Fuentes sans-serif geométricas modernas (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `Montserrat`).
  * Títulos con peso semi-bold (`font-semibold` o `font-bold`), texto de cuerpo legible con `leading-relaxed`.
* **Botones y Acciones**:
  * Botones con texto conciso y en negrita: *"Ver opciones de pago"*, *"Ajustar mi fecha"*, *"Hablar con un asesor"*.
  * Botón primario: fondo `#003B71` con texto `#FFFFFF`.
  * Botón de acento o apoyo: fondo `#FDDA24` con texto `#282828` en negrita.

---

## 4. Guía UX de Prevención Empática vs Cobranza Tradicional

| Elemento | Cobranza Tradicional (Evitar ❌) | Prevención Empática Bancoagrícola (Implementar ✅) |
| :--- | :--- | :--- |
| **Enfoque** | Reaccionar cuando ya cayó en mora | Detectar fricción 15 a 45 días antes del vencimiento |
| **Mensaje** | *"Su pago está vencido, pague inmediatamente"* | *"Notamos un mes con muchos gastos. ¿Deseas pausar o reducir tu cuota?"* |
| **Métrica Visible** | Días de atraso, intereses moratorios | Estado de tu Récord Crediticio (Score protector) |
| **Acción Ofrecida** | Pago total obligatorio | Micro-pagos, diferimiento de cuota, reestructuración con 1 click |
| **Tono del Bot** | Intimidante, legal, robótico | Comprensivo, asesor financiero, facilitador de acuerdos |
