---
name: motion
description: >-
  Guía y estándares de animación para React usando Motion (https://motion.dev - antes Framer Motion).
  Cubre animaciones fluidas, transiciones de layout, gestos, AnimatePresence y mejores prácticas de rendimiento.
---

# Motion (motion.dev) Guidelines for React & Next.js

Esta habilidad define cómo implementar micro-interacciones, transiciones de estado y animaciones fluidas en React utilizando la biblioteca oficial **Motion** ([motion.dev](https://motion.dev)).

---

## 1. Paquete e Importaciones Oficiales

Motion ahora se distribuye bajo el paquete unificado `motion`:

```bash
npm install motion
```

### Sintaxis de Importación en React (Next.js App Router)
Todo componente que use Motion interactivo debe llevar `'use client'`:

```tsx
'use client';

import * as motion from "motion/react";
// O importaciones nombradas:
import { motion, AnimatePresence } from "motion/react";
```

> **Nota de compatibilidad:** Si se usa `framer-motion`, la sintaxis es análoga (`from "framer-motion"`), pero la versión moderna oficial recomendada por motion.dev es `motion/react`.

---

## 2. Patrones Clave de Animación

### A. Animación de Entrada / Fade & Slide
```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -16 }}
  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
>
  {/* Contenido */}
</motion.div>
```

### B. Gestos e Interactividad (Hover, Tap)
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
  className="bg-agricola-blue text-white px-4 py-2 rounded-button"
>
  Acción Empática
</motion.button>
```

### C. Salidas Fluidas con `AnimatePresence`
```tsx
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      key="modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      Modal de propuesta de pago
    </motion.div>
  )}
</AnimatePresence>
```

### D. Animaciones Compartidas de Layout (`layoutId`)
Ideal para tabs, tarjetas expandibles o transiciones de estados:
```tsx
<motion.div layout layoutId="active-pill" className="bg-agricola-yellow" />
```

---

## 3. Reglas de Oro de Rendimiento y Accesibilidad

1. **Animar Únicamente Propiedades GPU (`transform` y `opacity`)**:
   * ✅ Bueno: `x`, `y`, `scale`, `rotate`, `opacity`.
   * ❌ Evitar: `width`, `height`, `top`, `left`, `margin` (causan reflow en el navegador).
2. **Respeto a la Preferencia de Movimiento Reducido**:
   * Usar `useReducedMotion()` para usuarios con sensibilidad vestibular:
   ```tsx
   import { useReducedMotion } from "motion/react";
   const shouldReduceMotion = useReducedMotion();
   const animate = shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 };
   ```
3. **Curvas de Aceleración Suaves (Springs Físicos)**:
   * Preferir animaciones de tipo spring para feedback táctil en botones y tarjetas (`stiffness: 300, damping: 30`).
