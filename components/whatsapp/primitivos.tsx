"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { Autor, EstadoEntrega } from "./types";

/**
 * Piezas atómicas del canal: burbuja, checks, marcadores, indicador de escritura.
 *
 * Esto es deliberadamente código propio y no shadcn. shadcn impone tokens
 * semánticos (bg-primary, text-muted-foreground) y su propia regla es no
 * sobrescribir sus colores; replicar WhatsApp es exactamente lo contrario —
 * exige SUS colores, SU radio de 7.5px, SU cola y SU sombra de 0.5px. shadcn se
 * usa donde sí aporta: la consola interna del banco.
 */

/* -------------------------------------------------------------------------- */
/* Checks de entrega                                                           */
/* -------------------------------------------------------------------------- */

export function Checks({ estado }: { estado: EstadoEntrega }) {
  const reducido = useReducedMotion();

  if (estado === "enviando") {
    return (
      <svg viewBox="0 0 16 15" className="h-[15px] w-4 text-wa-meta" aria-label="Enviando">
        <circle cx="8" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M8 4.5v3.2l2 1.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const leido = estado === "leido";
  const doble = estado !== "enviado";

  return (
    <motion.svg
      viewBox="0 0 16 15"
      className={cn("h-[15px] w-4", leido ? "text-wa-blue" : "text-wa-meta")}
      aria-label={leido ? "Leído" : doble ? "Entregado" : "Enviado"}
      initial={false}
      animate={reducido ? undefined : { scale: [1, 1.18, 1] }}
      transition={{ duration: 0.3 }}
    >
      <path
        d="M5.6 10.4 2.4 7.3l-.9.9 4.1 4 7-7-.9-.9z"
        fill="currentColor"
        transform={doble ? "translate(-2.4 0)" : undefined}
      />
      {doble && <path d="M9.6 10.4 6.4 7.3l-.9.9 4.1 4 7-7-.9-.9z" fill="currentColor" />}
    </motion.svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Burbuja                                                                     */
/* -------------------------------------------------------------------------- */

export function Burbuja({
  autor,
  conCola = true,
  ancha = false,
  sinRelleno = false,
  reaccion,
  anotacion,
  reaccionSugerida,
  onReaccionar,
  children,
}: {
  autor: Autor;
  /** WhatsApp solo dibuja la cola en el primer mensaje de cada grupo. */
  conCola?: boolean;
  /** Los mensajes interactivos (lista, encuesta, flujo) usan un ancho mayor. */
  ancha?: boolean;
  sinRelleno?: boolean;
  reaccion?: string;
  /** Etiqueta del tipo de la API real; solo visible en modo inspección. */
  anotacion?: string;
  /** Reacción rápida ofrecida al lado de la burbuja, como el gesto de WhatsApp. */
  reaccionSugerida?: string;
  onReaccionar?: () => void;
  children: ReactNode;
}) {
  const reducido = useReducedMotion();
  const saliente = autor === "cliente";

  return (
    <motion.div
      layout={!reducido}
      initial={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
      style={{ transformOrigin: saliente ? "bottom right" : "bottom left" }}
      className={cn("flex w-full", saliente ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          // Anchos relativos, no fijos: el marco del teléfono se adapta al alto de
          // la pantalla, así que un ancho en px desborda el hilo en laptops bajas.
          "relative",
          ancha ? "w-[86%] max-w-[300px]" : "max-w-[86%]",
          reaccion && "mb-3",
          anotacion && "mt-4",
        )}
      >
        {anotacion && (
          <span
            className={cn(
              "absolute -top-[15px] z-10 whitespace-nowrap rounded-sm bg-agricola-blue px-1.5 py-[1px] font-mono text-[9px] font-medium tracking-tight text-white/90",
              saliente ? "right-0" : "left-0",
            )}
          >
            {anotacion}
          </span>
        )}

        <div
          className={cn(
            "relative rounded-bubble text-[14.2px] leading-[19px] text-wa-text shadow-bubble",
            saliente ? "bg-wa-out" : "bg-wa-in",
            !sinRelleno && "px-[9px] pb-[8px] pt-[6px]",
            ancha ? "w-full" : "w-fit max-w-full",
            conCola && (saliente ? "rounded-tr-none wa-tail-out" : "rounded-tl-none wa-tail-in"),
          )}
        >
          {children}
        </div>

        {reaccionSugerida && onReaccionar && !reaccion && (
          <motion.button
            type="button"
            onClick={onReaccionar}
            initial={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.85 }}
            transition={{ type: "spring", stiffness: 460, damping: 22 }}
            aria-label={`Reaccionar con ${reaccionSugerida}`}
            className={cn(
              // Flota sobre la esquina superior de la burbuja, como el selector de
              // reacciones de WhatsApp. Fuera del ancho del hilo generaría scroll
              // horizontal en el teléfono.
              "absolute -top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-white text-[15px] shadow-md",
              saliente ? "left-1" : "right-1",
            )}
          >
            <motion.span
              animate={reducido ? undefined : { scale: [1, 1.18, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            >
              {reaccionSugerida}
            </motion.span>
          </motion.button>
        )}

        {reaccion && (
          <motion.span
            initial={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.2, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className={cn(
              "absolute -bottom-[13px] flex h-[22px] items-center rounded-full border border-black/5 bg-white px-1.5 text-[12px] shadow-sm",
              saliente ? "right-2" : "left-2",
            )}
          >
            {reaccion}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Meta: hora + checks dentro de la burbuja                                    */
/* -------------------------------------------------------------------------- */

/**
 * WhatsApp coloca la hora abajo a la derecha DENTRO de la burbuja, flotada, y el
 * texto la rodea. Es ese detalle el que hace que se lea como WhatsApp y no como
 * un chat genérico.
 */
export function Meta({
  hora,
  estado,
  className,
}: {
  hora: string;
  estado?: EstadoEntrega;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "float-right ml-2 mt-[7px] flex translate-y-[2px] items-center gap-[3px] text-[11px] leading-none text-wa-meta",
        className,
      )}
    >
      {hora}
      {estado && <Checks estado={estado} />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Marcadores de sistema                                                       */
/* -------------------------------------------------------------------------- */

export function Marcador({
  variante,
  texto,
}: {
  variante: "cifrado" | "fecha" | "aviso";
  texto: string;
}) {
  const reducido = useReducedMotion();

  return (
    <motion.div
      layout={!reducido}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-center py-1"
    >
      <span
        className={cn(
          "max-w-[85%] rounded-md px-3 py-[5px] text-center text-[12.5px] leading-[17px] shadow-bubble",
          variante === "fecha" && "bg-white/90 font-medium uppercase tracking-wide text-wa-meta",
          variante === "cifrado" && "bg-wa-chip text-wa-chip-text",
          variante === "aviso" && "bg-white/90 text-wa-meta",
        )}
      >
        {variante === "cifrado" && (
          <svg
            viewBox="0 0 10 12"
            className="mr-1 inline-block h-3 w-2.5 -translate-y-px fill-current"
          >
            <path d="M5 0a3 3 0 0 0-3 3v2H1.5A1.5 1.5 0 0 0 0 6.5v4A1.5 1.5 0 0 0 1.5 12h7A1.5 1.5 0 0 0 10 10.5v-4A1.5 1.5 0 0 0 8.5 5H8V3a3 3 0 0 0-3-3Zm0 1.3A1.7 1.7 0 0 1 6.7 3v2H3.3V3A1.7 1.7 0 0 1 5 1.3Z" />
          </svg>
        )}
        {texto}
      </span>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Indicador de escritura                                                      */
/* -------------------------------------------------------------------------- */

export function Escribiendo() {
  const reducido = useReducedMotion();

  return (
    <motion.div
      layout={!reducido}
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 4 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="flex justify-start"
      aria-label="El asistente está escribiendo"
    >
      <div className="relative rounded-bubble rounded-tl-none bg-wa-in px-3 py-[11px] shadow-bubble wa-tail-in">
        <div className="flex items-center gap-[5px]">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-[7px] w-[7px] rounded-full bg-[#9aa5ab]"
              animate={reducido ? undefined : { y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Barra de estado del teléfono                                                */
/* -------------------------------------------------------------------------- */

export function BarraEstado({ hora }: { hora: string }) {
  return (
    <div className="flex h-7 shrink-0 items-center justify-between bg-wa-teal-dark px-5 text-[12px] font-medium text-white">
      <span className="tabular-nums">{hora}</span>
      <div className="flex items-center gap-1.5">
        <svg viewBox="0 0 18 12" className="h-3 w-[18px] fill-white" aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="0.5" />
          <rect x="5" y="5.5" width="3" height="6.5" rx="0.5" />
          <rect x="10" y="3" width="3" height="9" rx="0.5" />
          <rect x="15" y="0" width="3" height="12" rx="0.5" opacity="0.45" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-3 w-4 fill-white" aria-hidden>
          <path d="M8 11.2 5.6 8.4a3.7 3.7 0 0 1 4.8 0L8 11.2Z" />
          <path d="M8 5.6a6.3 6.3 0 0 0-4.3 1.7L2.3 5.8a8.3 8.3 0 0 1 11.4 0l-1.4 1.5A6.3 6.3 0 0 0 8 5.6Z" />
          <path d="M8 1.6c-2.7 0-5.2 1-7 2.8L0 3a11.8 11.8 0 0 1 16 0l-1 1.4A10.2 10.2 0 0 0 8 1.6Z" opacity="0.85" />
        </svg>
        <svg viewBox="0 0 26 12" className="h-3 w-[26px]" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            width="21"
            height="11"
            rx="3"
            fill="none"
            stroke="white"
            strokeOpacity="0.6"
          />
          <rect x="2" y="2" width="16" height="8" rx="1.6" fill="white" />
          <rect x="23" y="4" width="2" height="4" rx="1" fill="white" fillOpacity="0.6" />
        </svg>
      </div>
    </div>
  );
}
