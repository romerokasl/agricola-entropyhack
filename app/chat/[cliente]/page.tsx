import ChatThread from "./ChatThread";

import type { Apertura } from "@/lib/agent/types";

/**
 * El agente abre por defecto: es cobranza preventiva, el banco detecta y escribe
 * primero. Pero la persona también puede abrir (`?apertura=cliente`), porque en
 * producción un cliente siempre puede escribirle al banco por su cuenta.
 */
export default function PaginaChat({
  params,
  searchParams,
}: {
  params: { cliente: string };
  searchParams: { apertura?: string };
}) {
  const apertura: Apertura = searchParams.apertura === "cliente" ? "cliente" : "agente";
  return <ChatThread slug={params.cliente} apertura={apertura} />;
}
