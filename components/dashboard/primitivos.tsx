"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, type ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Piezas de presentación del dashboard.
 *
 * Regla que atraviesa todo el archivo: la UI no calcula nada y `null` no es cero.
 * Cuando una cifra no existe se muestra "—" (SIN_DATO), nunca "0 %" ni "$0.00".
 * Fuente: docs/dashboard-contrato.md.
 */

/* -------------------------------------------------------------------------- */
/* Número animado                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Cuenta hasta el valor final. Recibe ya el formateador del contrato
 * (`usd`, `entero`, `ms`…) para que el formato no se duplique acá.
 */
export function NumeroAnimado({
  valor,
  formato,
  className,
}: {
  valor: number | null;
  formato: (v: number | null) => string;
  className?: string;
}) {
  const reducido = useReducedMotion();
  const crudo = useMotionValue(0);
  const suave = useSpring(crudo, { stiffness: 90, damping: 20, mass: 0.6 });
  const texto = useTransform(suave, (v) => formato(v));

  useEffect(() => {
    if (valor !== null) crudo.set(valor);
  }, [valor, crudo]);

  // Sin dato o con movimiento reducido: el valor final, sin animar.
  if (valor === null || reducido) {
    return <span className={className}>{formato(valor)}</span>;
  }

  return <motion.span className={className}>{texto}</motion.span>;
}

/* -------------------------------------------------------------------------- */
/* Sección                                                                     */
/* -------------------------------------------------------------------------- */

export function Seccion({
  titulo,
  nota,
  accion,
  children,
}: {
  titulo: string;
  nota?: ReactNode;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold tracking-tight text-agricola-dark">{titulo}</h2>
          {nota && (
            <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-agricola-dark-muted">
              {nota}
            </p>
          )}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Entrada escalonada de las tarjetas de una grilla. */
export function Aparece({
  indice = 0,
  className,
  children,
}: {
  indice?: number;
  className?: string;
  children: ReactNode;
}) {
  const reducido = useReducedMotion();

  return (
    <motion.div
      initial={reducido ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reducido ? 0 : indice * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tarjetas                                                                    */
/* -------------------------------------------------------------------------- */

export function Tarjeta({
  titulo,
  nota,
  className,
  children,
}: {
  titulo?: string;
  nota?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "h-full border-agricola-border bg-agricola-bg-white shadow-subtle",
        className,
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-5">
        {titulo && (
          <div>
            <h3 className="text-[14px] font-semibold text-agricola-dark">{titulo}</h3>
            {nota && (
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-agricola-dark-muted">{nota}</p>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export type TonoKpi = "neutro" | "ok" | "espera" | "alerta";

const TONO_VALOR: Record<TonoKpi, string> = {
  neutro: "text-agricola-dark",
  ok: "text-viz-ok",
  espera: "text-agricola-yellow-dark",
  alerta: "text-viz-alerta",
};

/**
 * Cifra de titular. `detalle` es obligatorio a propósito: toda tasa tiene que
 * mostrar su n y todo supuesto su texto, así que no hay KPI sin letra chica.
 */
export function Kpi({
  etiqueta,
  valor,
  formato,
  textoDirecto,
  detalle,
  tono = "neutro",
  icono,
}: {
  etiqueta: string;
  valor?: number | null;
  formato?: (v: number | null) => string;
  /** Para valores que ya vienen como texto (p. ej. duraciones). */
  textoDirecto?: string;
  detalle: ReactNode;
  tono?: TonoKpi;
  icono?: ReactNode;
}) {
  return (
    <Tarjeta>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium uppercase tracking-wide text-agricola-dark-muted">
          {etiqueta}
        </p>
        {icono && <span className="shrink-0 text-agricola-dark-subtle">{icono}</span>}
      </div>

      <p className={cn("text-[30px] font-semibold leading-none tabular-nums", TONO_VALOR[tono])}>
        {textoDirecto !== undefined ? (
          textoDirecto
        ) : (
          <NumeroAnimado valor={valor ?? null} formato={formato ?? String} />
        )}
      </p>

      <p className="mt-auto text-[12px] leading-relaxed text-agricola-dark-muted">{detalle}</p>
    </Tarjeta>
  );
}

/* -------------------------------------------------------------------------- */
/* Lista de datos                                                              */
/* -------------------------------------------------------------------------- */

export function Datos({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="flex flex-col">
      {items.map(([etiqueta, valor], i) => (
        <div
          key={etiqueta}
          className={cn(
            "flex items-baseline justify-between gap-4 py-[7px]",
            i > 0 && "border-t border-agricola-border-light",
          )}
        >
          <dt className="text-[13px] text-agricola-dark-muted">{etiqueta}</dt>
          <dd className="text-right text-[13px] font-medium tabular-nums text-agricola-dark">
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */
/* Avisos                                                                      */
/* -------------------------------------------------------------------------- */

export function NotaSupuesto({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-agricola-yellow-dark/30 bg-agricola-yellow-light px-3 py-2 text-[12px] leading-relaxed text-agricola-dark">
      {children}
    </p>
  );
}

export function NotaFina({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11.5px] leading-relaxed text-agricola-dark-subtle">{children}</p>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-agricola-border bg-agricola-bg px-3 py-6 text-center text-[13px] text-agricola-dark-muted">
      {children}
    </p>
  );
}
