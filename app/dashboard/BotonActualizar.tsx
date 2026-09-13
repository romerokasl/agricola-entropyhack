"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Vuelve a pedir los datos al servidor sin recargar la página. */
export default function BotonActualizar() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      onClick={() => iniciar(() => router.refresh())}
      disabled={pendiente}
      className="rounded-button border border-agricola-border bg-agricola-bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
    >
      {pendiente ? "Actualizando…" : "Actualizar"}
    </button>
  );
}
