import LlamadaVoz from "./LlamadaVoz";

import type { Apertura } from "@/lib/agent/types";

/**
 * El mismo caso que `/chat/[cliente]`, pero hablado. Comparte cliente, reglas, señal de
 * riesgo y tablas — lo único distinto es que la entrada y la salida son audio.
 */
export default function PaginaVoz({
  params,
  searchParams,
}: {
  params: { cliente: string };
  searchParams: { apertura?: string };
}) {
  const apertura: Apertura = searchParams.apertura === "cliente" ? "cliente" : "agente";
  return <LlamadaVoz slug={params.cliente} apertura={apertura} />;
}
