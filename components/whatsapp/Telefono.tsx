"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Marco del teléfono. Existe por una razón de demo, no decorativa: encuadrar el
 * canal deja claro de un vistazo qué ve la persona y qué ve el banco. Todo lo
 * que está dentro del marco es lo que recibe el cliente.
 */
export function Telefono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative w-fit max-w-[calc(100vw-2.5rem)] shrink-0 rounded-[44px] bg-[#1c1c1e] p-[11px] shadow-phone",
        className,
      )}
    >
      {/* Aro metálico */}
      <div className="pointer-events-none absolute inset-[4px] rounded-[40px] ring-1 ring-white/10" />

      <div className="alto-demo relative aspect-[392/812] overflow-hidden rounded-[34px] bg-black">
        {/* Isla dinámica */}
        <div className="absolute left-1/2 top-[10px] z-40 h-[26px] w-[108px] -translate-x-1/2 rounded-full bg-black" />
        <div className="h-full w-full pt-0">{children}</div>
        {/* Barra de gesto */}
        <div className="pointer-events-none absolute bottom-[6px] left-1/2 z-40 h-[4px] w-[124px] -translate-x-1/2 rounded-full bg-black/25" />
      </div>
    </div>
  );
}
