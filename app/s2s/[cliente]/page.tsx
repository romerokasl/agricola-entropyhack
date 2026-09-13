import type { Metadata } from "next";

import type { Apertura } from "@/lib/agent/types";

import LlamadaS2S from "./LlamadaS2S";

export const metadata: Metadata = { title: "Llamada S2S · Bancoagrícola" };

/**
 * El mismo caso que `/voz/[cliente]`, con el enfoque speech-to-speech. Comparte cliente,
 * reglas, señal de riesgo, validador y tablas: lo único distinto es quién genera la voz.
 */
export default function PaginaS2S({
  params,
  searchParams,
}: {
  params: { cliente: string };
  searchParams: { apertura?: string };
}) {
  const apertura: Apertura = searchParams.apertura === "cliente" ? "cliente" : "agente";
  return <LlamadaS2S slug={params.cliente} apertura={apertura} />;
}
