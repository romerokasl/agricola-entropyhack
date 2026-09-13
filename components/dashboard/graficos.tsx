"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { Vacio } from "./primitivos";

/**
 * Gráficos del dashboard.
 *
 * Deliberadamente sin librería de charting: todos los conjuntos de datos del
 * contrato son pequeños y categóricos (4 estados, 8 escalones, 5 bandas), así que
 * Recharts sería ~100 kB para dibujar barras. Esto es SVG/CSS con `motion`, lo que
 * además deja aplicar al pie las especificaciones de marcas de la skill de dataviz:
 * extremo de dato redondeado a 4px anclado a la línea base, 2px de superficie entre
 * segmentos apilados, rejilla recesiva y etiquetas directas.
 *
 * La animación es solo `transform: scaleX` — el ancho se fija desde el dato y no se
 * anima, para no provocar reflow (regla de rendimiento de motion.dev).
 */

/* -------------------------------------------------------------------------- */
/* Rampa ordinal                                                               */
/* -------------------------------------------------------------------------- */

/** Rampa validada en OKLCH sobre el azul de marca. Claro → oscuro = más costo. */
export const RAMPA_ORDINAL = [
  "var(--viz-ord-1)",
  "var(--viz-ord-2)",
  "var(--viz-ord-3)",
  "var(--viz-ord-4)",
] as const;

export const COLOR_SOLO = "var(--viz-solo)";

export interface Dato {
  clave: string;
  etiqueta: string;
  cantidad: number;
  /** Color explícito. Si falta, se usa la serie única. */
  color?: string;
  /** Texto extra que solo aparece al pasar el cursor. */
  ayuda?: ReactNode;
}

/* -------------------------------------------------------------------------- */
/* Barras horizontales                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Barras horizontales con etiqueta directa. El ancho es proporcional al máximo
 * del grupo, no al total: compara magnitudes, no partes de un todo.
 */
export function BarrasHorizontales({
  datos,
  vacio,
  mostrarShare = false,
}: {
  datos: readonly Dato[];
  vacio: string;
  /** Agrega el % sobre el total en el tooltip. */
  mostrarShare?: boolean;
}) {
  const reducido = useReducedMotion();
  const maximo = Math.max(0, ...datos.map((d) => d.cantidad));
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);

  if (datos.length === 0) return <Vacio>{vacio}</Vacio>;

  return (
    <ul className="flex flex-col gap-1">
      {datos.map((d, i) => {
        const pct = maximo > 0 ? (d.cantidad / maximo) * 100 : 0;
        const share = total > 0 ? (d.cantidad / total) * 100 : null;

        return (
          <li key={d.clave}>
            <Tooltip>
              <TooltipTrigger asChild>
                {/* La etiqueta va arriba y la barra ocupa todo el ancho: una columna
                    de etiqueta fija ahogaba la pista dentro de tarjetas angostas. */}
                <div className="flex cursor-default flex-col gap-1 rounded-md px-1 py-1.5 transition-colors hover:bg-agricola-bg">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px] text-agricola-dark-muted">
                      {d.etiqueta}
                    </span>
                    {/* Etiqueta directa: el número siempre visible, nunca solo color. */}
                    <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-agricola-dark">
                      {d.cantidad}
                    </span>
                  </div>

                  {/* Pista recesiva; la barra se ancla a la izquierda. */}
                  <span className="relative block h-[8px] w-full overflow-hidden rounded-[4px] bg-viz-track">
                    <motion.span
                      className="absolute inset-y-0 left-0 block origin-left rounded-[4px]"
                      style={{ width: `${pct}%`, backgroundColor: d.color ?? COLOR_SOLO }}
                      initial={reducido ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{
                        duration: 0.55,
                        delay: i * 0.04,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px]">
                <p className="font-medium">{d.etiqueta}</p>
                <p className="tabular-nums">
                  {d.cantidad}
                  {mostrarShare && share !== null && ` · ${share.toFixed(1)} % del total`}
                </p>
                {d.ayuda && <p className="mt-1 opacity-80">{d.ayuda}</p>}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Barra apilada (parte-de-un-todo)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Parte-de-un-todo en una sola barra horizontal, con leyenda y número visible por
 * segmento.
 *
 * La leyenda no es decorativa: uno de los colores de estado (el ámbar) queda en
 * 2.15:1 contra blanco, por debajo del piso de 3:1, y la skill de dataviz exige
 * entonces un canal de alivio. Ese canal son estas etiquetas con su cifra.
 */
export function BarraApilada({ datos, vacio }: { datos: readonly Dato[]; vacio: string }) {
  const reducido = useReducedMotion();
  const total = datos.reduce((acc, d) => acc + d.cantidad, 0);

  if (total === 0) return <Vacio>{vacio}</Vacio>;

  const presentes = datos.filter((d) => d.cantidad > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* 2px de superficie entre segmentos, como pide la especificación de marcas. */}
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]">
        {presentes.map((d, i) => (
          <Tooltip key={d.clave}>
            <TooltipTrigger asChild>
              <motion.span
                className="block h-full origin-left cursor-default rounded-[3px]"
                style={{
                  width: `${(d.cantidad / total) * 100}%`,
                  backgroundColor: d.color ?? COLOR_SOLO,
                }}
                initial={reducido ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{d.etiqueta}</p>
              <p className="tabular-nums">
                {d.cantidad} de {total} · {((d.cantidad / total) * 100).toFixed(1)} %
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {datos.map((d) => (
          <li key={d.clave} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: d.color ?? COLOR_SOLO }}
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-agricola-dark-muted">
              {d.etiqueta}
            </span>
            <span className="shrink-0 text-[12.5px] font-medium tabular-nums text-agricola-dark">
              {d.cantidad}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Distribución (p50 / p95 / máx)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Los percentiles del contrato sobre una pista común.
 *
 * No dibuja umbral ni semáforo de SLA: el contrato no define ninguno y pintar uno
 * sería inventar una medición. La escala llega hasta el máximo observado.
 */
export function Percentiles({
  p50,
  p95,
  max,
  n,
  formato,
  vacio,
}: {
  p50: number | null;
  p95: number | null;
  max: number | null;
  n: number;
  formato: (v: number | null) => string;
  vacio: string;
}) {
  const reducido = useReducedMotion();

  if (n === 0 || max === null || max === 0) return <Vacio>{vacio}</Vacio>;

  const marcas = [
    { clave: "p50", etiqueta: "Mediana (p50)", valor: p50, color: "var(--viz-ord-2)" },
    { clave: "p95", etiqueta: "p95", valor: p95, color: "var(--viz-ord-3)" },
    { clave: "max", etiqueta: "Máximo", valor: max, color: "var(--viz-ord-4)" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-9">
        {/* Pista recesiva de 0 al máximo observado. */}
        <span className="absolute inset-x-0 top-[14px] h-[6px] rounded-[3px] bg-viz-track" />

        {marcas.map(({ clave, etiqueta, valor, color }, i) => {
          if (valor === null) return null;
          const pos = Math.min(100, (valor / max) * 100);

          return (
            <Tooltip key={clave}>
              <TooltipTrigger asChild>
                <motion.span
                  className="absolute top-[8px] block h-[18px] w-[3px] cursor-default rounded-[2px] ring-2 ring-white"
                  style={{ left: `calc(${pos}% - 1.5px)`, backgroundColor: color }}
                  initial={reducido ? false : { scaleY: 0, opacity: 0 }}
                  animate={{ scaleY: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{etiqueta}</p>
                <p className="tabular-nums">{formato(valor)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {marcas.map(({ clave, etiqueta, valor, color }) => (
          <li key={clave} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-[9px] w-[3px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: color }}
            />
            <span className="text-[12px] text-agricola-dark-muted">{etiqueta}</span>
            <span className="text-[12px] font-medium tabular-nums text-agricola-dark">
              {formato(valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
