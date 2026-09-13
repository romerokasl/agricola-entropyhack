"use client";

import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ETIQUETA_ESTADO,
  entero,
  etiquetaEscalon,
  fecha,
  ms,
  SIN_DATO,
  usd,
} from "@/app/dashboard/formato";
import type { EstadoConversacion } from "@/lib/agent/types";
import type { FilaAuditoria } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

import { Vacio } from "./primitivos";

/**
 * Auditoría fila por fila. El nombre ya viene enmascarado desde el contrato
 * (`K. M*****`); acá no se desenmascara nada. La transcripción literal vive en la
 * ficha de la conversación, no en esta tabla.
 */

const ESTILO_ESTADO: Record<EstadoConversacion, string> = {
  cerrada_con_acuerdo: "bg-agricola-status-safe-bg text-viz-ok",
  cerrada_sin_acuerdo: "bg-agricola-yellow-light text-agricola-yellow-dark",
  escalada_humano: "bg-agricola-blue-light text-agricola-blue",
  abierta: "bg-agricola-bg-alt text-agricola-dark-muted",
};

function InsigniaEstado({ estado }: { estado: EstadoConversacion }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-medium",
        ESTILO_ESTADO[estado],
      )}
    >
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}

const TODOS = "todos";

export function TablaAuditoria({ filas }: { filas: readonly FilaAuditoria[] }) {
  const reducido = useReducedMotion();
  const [filtro, setFiltro] = useState<string>(TODOS);

  const visibles = useMemo(
    () => (filtro === TODOS ? filas : filas.filter((f) => f.estado === filtro)),
    [filas, filtro],
  );

  if (filas.length === 0) {
    return <Vacio>No hay conversaciones registradas todavía.</Vacio>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="h-9 w-[240px] border-agricola-border bg-agricola-bg-white text-[13px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los estados</SelectItem>
            {(Object.keys(ETIQUETA_ESTADO) as EstadoConversacion[]).map((e) => (
              <SelectItem key={e} value={e}>
                {ETIQUETA_ESTADO[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-[12.5px] text-agricola-dark-muted">
          {visibles.length === filas.length
            ? `${filas.length} conversación(es)`
            : `${visibles.length} de ${filas.length} conversación(es)`}
        </p>
      </div>

      <div className="scroll-fino overflow-x-auto rounded-card border border-agricola-border bg-agricola-bg-white">
        <Table>
          <TableHeader>
            <TableRow className="border-agricola-border hover:bg-transparent">
              {[
                "ID",
                "Cliente",
                "Producto",
                "Cuota",
                "Estado",
                "Resultado",
                "Turnos",
                "Latencia p95",
                "Tokens in / out",
                "Validador",
                "Iniciada",
              ].map((h) => (
                <TableHead
                  key={h}
                  className="whitespace-nowrap bg-agricola-bg-alt text-[11.5px] font-medium uppercase tracking-wide text-agricola-dark-muted"
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibles.map((f, i) => (
              <motion.tr
                key={f.conversacionId}
                initial={reducido ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.02 }}
                className="border-b border-agricola-border-light align-top transition-colors hover:bg-agricola-bg"
              >
                <TableCell className="py-2.5">
                  <Link
                    href={`/dashboard/conversaciones/${f.conversacionId}`}
                    className="inline-flex items-center gap-1 font-mono text-[12px] font-medium text-agricola-blue underline-offset-2 hover:underline"
                  >
                    {f.idCorto}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap py-2.5 text-[12.5px]">
                  {f.clienteEnmascarado}
                </TableCell>
                <TableCell className="py-2.5 text-[12.5px] text-agricola-dark-muted">
                  {f.producto ?? SIN_DATO}
                </TableCell>
                <TableCell className="whitespace-nowrap py-2.5 text-[12.5px] tabular-nums">
                  {usd(f.cuota)}
                </TableCell>
                <TableCell className="py-2.5">
                  <InsigniaEstado estado={f.estado} />
                </TableCell>
                <TableCell className="max-w-[280px] py-2.5 text-[12.5px] text-agricola-dark-muted">
                  {f.acuerdo ? (
                    <span>
                      <span className="font-medium text-agricola-dark">
                        E{f.acuerdo.escalon} · {etiquetaEscalon(f.acuerdo.tipo)}
                      </span>
                      {f.acuerdo.monto !== null && ` · ${usd(f.acuerdo.monto)}`}
                      {f.acuerdo.fechaAcordada && ` · ${f.acuerdo.fechaAcordada}`}
                    </span>
                  ) : (
                    (f.motivoNoAcuerdo ?? SIN_DATO)
                  )}
                </TableCell>
                <TableCell className="py-2.5 text-[12.5px] tabular-nums">{f.turnos}</TableCell>
                <TableCell className="whitespace-nowrap py-2.5 text-[12.5px] tabular-nums">
                  {ms(f.latenciaP95Ms)}
                </TableCell>
                <TableCell className="whitespace-nowrap py-2.5 text-[12.5px] tabular-nums text-agricola-dark-muted">
                  {entero(f.tokensEntrada)} / {entero(f.tokensSalida)}
                </TableCell>
                <TableCell className="py-2.5 text-[12.5px] tabular-nums">
                  {f.intervencionesValidador === 0 ? (
                    <span className="text-agricola-dark-subtle">0</span>
                  ) : (
                    <span className="font-medium text-viz-alerta">
                      {f.intervencionesValidador}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap py-2.5 text-[12px] text-agricola-dark-muted">
                  {fecha(f.iniciadaEn)}
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {visibles.length === 0 && (
        <Vacio>No hay conversaciones con ese estado.</Vacio>
      )}
    </div>
  );
}
