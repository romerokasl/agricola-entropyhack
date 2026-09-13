"use client";

import {
  Brain,
  Database,
  GitBranch,
  Radar,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ESCALERA } from "@/lib/agent/ladder";
import type { Escenario, MetricasTurno, PasoConsola, TipoPaso } from "@/lib/demo/guion-whatsapp";
import { cn } from "@/lib/utils";

/**
 * La consola que ve el banco mientras la persona conversa.
 *
 * Existe por la regla de diseño del proyecto: el cliente NUNCA ve rojo, porque
 * rojo = vergüenza = evasión. El rojo, la banda de riesgo y los números viven
 * acá adentro, del lado del banco, y nunca cruzan al canal.
 */

const ICONOS: Record<TipoPaso, ComponentType<{ className?: string }>> = {
  disparador: Radar,
  razonamiento: Brain,
  tool: Terminal,
  guardrail: ShieldCheck,
  decision: GitBranch,
  registro: Database,
};

const COLORES: Record<TipoPaso, string> = {
  disparador: "bg-agricola-brand-sky/15 text-[#1E7A96] ring-agricola-brand-sky/30",
  razonamiento: "bg-agricola-blue-light text-agricola-blue ring-agricola-blue/20",
  tool: "bg-agricola-dark/[0.06] text-agricola-dark-muted ring-agricola-dark/10",
  guardrail: "bg-agricola-brand-green-soft text-[#00875F] ring-agricola-brand-green/30",
  decision: "bg-agricola-yellow-light text-agricola-yellow-dark ring-agricola-yellow/40",
  registro: "bg-agricola-brand-green-soft text-[#00875F] ring-agricola-brand-green/30",
};

const NOMBRE_TIPO: Record<TipoPaso, string> = {
  disparador: "disparador",
  razonamiento: "razonamiento",
  tool: "herramienta",
  guardrail: "guardrail",
  decision: "decisión",
  registro: "registro",
};

const BANDA: Record<Escenario["banda"], { texto: string; clase: string }> = {
  SANO: {
    texto: "Sano · no contactar",
    clase: "bg-agricola-status-safe-bg text-agricola-status-safe",
  },
  PREVENTIVO: {
    texto: "Preventivo",
    clase: "bg-agricola-status-warning-bg text-agricola-status-warning",
  },
  ATENCION: {
    texto: "Atención temprana",
    clase: "bg-agricola-status-alert-bg text-agricola-status-alert",
  },
};

/* -------------------------------------------------------------------------- */

function Paso({ paso }: { paso: PasoConsola }) {
  const Icono = ICONOS[paso.tipo];
  const reducido = useReducedMotion();

  return (
    <motion.li
      layout={!reducido}
      initial={reducido ? { opacity: 0 } : { opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="flex gap-3"
    >
      <span
        className={cn(
          "mt-[2px] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1",
          COLORES[paso.tipo],
        )}
      >
        <Icono className="h-[15px] w-[15px]" />
      </span>
      <span className="min-w-0 flex-1 pb-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "text-[13.5px] font-medium leading-[18px] text-agricola-dark",
              paso.tipo === "tool" && "font-mono text-[12.5px]",
            )}
          >
            {paso.etiqueta}
          </span>
          <span className="rounded-sm bg-agricola-bg-alt px-1.5 py-[1px] font-mono text-[9.5px] uppercase tracking-wide text-agricola-dark-subtle">
            {NOMBRE_TIPO[paso.tipo]}
          </span>
        </span>
        {paso.detalle && (
          <span className="mt-0.5 block text-[12.5px] leading-[17px] text-agricola-dark-muted">
            {paso.detalle}
          </span>
        )}
      </span>
    </motion.li>
  );
}

function Pensando() {
  const reducido = useReducedMotion();

  return (
    <motion.li
      layout={!reducido}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 pt-1"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-agricola-blue-light ring-1 ring-agricola-blue/20">
        <motion.span
          animate={reducido ? undefined : { rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          className="block"
        >
          <Brain className="h-[15px] w-[15px] text-agricola-blue" />
        </motion.span>
      </span>
      <span className="flex flex-1 flex-col gap-1.5">
        {[0, 1].map((i) => (
          <motion.span
            key={i}
            className="block h-[9px] rounded-full bg-agricola-border"
            style={{ width: i === 0 ? "68%" : "44%" }}
            animate={reducido ? undefined : { opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </span>
    </motion.li>
  );
}

function Metrica({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: "ok" }) {
  return (
    <div className="rounded-lg border border-agricola-border bg-agricola-bg-white px-3 py-2">
      <p className="text-[10.5px] uppercase tracking-wide text-agricola-dark-subtle">{etiqueta}</p>
      <p
        className={cn(
          "mt-0.5 text-[16px] font-semibold tabular-nums leading-tight text-agricola-dark",
          tono === "ok" && "text-agricola-status-safe",
        )}
      >
        {valor}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface PropsConsola {
  escenario: Escenario;
  pasos: readonly PasoConsola[];
  pensando: boolean;
  metricas: MetricasTurno | null;
  escalonActual: number | null;
  turnos: number;
  guardrails: number;
}

export function ConsolaBanco({
  escenario,
  pasos,
  pensando,
  metricas,
  escalonActual,
  turnos,
  guardrails,
}: PropsConsola) {
  const banda = BANDA[escenario.banda];

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <Card className="shrink-0 border-agricola-border shadow-subtle">
        <CardHeader className="gap-1 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-1.5 text-[15px] text-agricola-dark">
                <img
                  src="/bancoagricola_blackfont_logo.svg"
                  alt="Bancoagrícola"
                  className="h-[13px] w-auto shrink-0"
                />
                <span className="text-agricola-dark-subtle">· Consola interna</span>
              </CardTitle>
              <CardDescription className="text-[12.5px] text-agricola-dark-muted">
                Lo que el banco ve. Nada de esto cruza al canal.
              </CardDescription>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                banda.clase,
              )}
            >
              {banda.texto}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="rounded-lg border border-agricola-border bg-agricola-bg px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-agricola-dark">
              <Radar className="h-3.5 w-3.5 text-agricola-blue" />
              {escenario.disparador.titulo}
            </p>
            <p className="mt-1 font-mono text-[11.5px] leading-[16px] text-agricola-blue">
              {escenario.disparador.senal}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-[17px] text-agricola-dark-muted">
              {escenario.disparador.detalle}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="razonamiento" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full shrink-0 bg-agricola-bg-alt">
          <TabsTrigger value="razonamiento" className="flex-1 text-[12.5px]">
            Razonamiento
          </TabsTrigger>
          <TabsTrigger value="escalera" className="flex-1 text-[12.5px]">
            Escalera
          </TabsTrigger>
          <TabsTrigger value="expediente" className="flex-1 text-[12.5px]">
            Expediente
          </TabsTrigger>
        </TabsList>

        {/* --- Razonamiento -------------------------------------------------- */}
        <TabsContent value="razonamiento" className="mt-2 min-h-0 flex-1">
          <Card className="flex h-full flex-col border-agricola-border shadow-subtle">
            <CardContent className="min-h-0 flex-1 overflow-y-auto p-4">
              {pasos.length === 0 && !pensando ? (
                <p className="py-8 text-center text-[13px] text-agricola-dark-subtle">
                  Todavía no hay turnos. Dale play al escenario.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {pasos.map((p) => (
                      <Paso key={p.id} paso={p} />
                    ))}
                    {pensando && <Pensando key="pensando" />}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>

            <Separator />

            <div className="grid shrink-0 grid-cols-4 gap-2 p-3">
              <Metrica etiqueta="Turnos" valor={String(turnos)} />
              <Metrica
                etiqueta="Latencia"
                valor={metricas ? `${(metricas.latenciaMs / 1000).toFixed(2)}s` : "—"}
              />
              <Metrica
                etiqueta="Tokens"
                valor={metricas ? `${metricas.tokensIn}/${metricas.tokensOut}` : "—"}
              />
              <Metrica etiqueta="Guardrails" valor={String(guardrails)} tono="ok" />
            </div>

            <div className="shrink-0 border-t border-agricola-border px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] text-agricola-dark-muted">
                {metricas?.validadorOk === false ? (
                  <>
                    <TriangleAlert className="h-3.5 w-3.5 text-agricola-status-alert" />
                    <span className="text-agricola-status-alert">
                      El validador intervino: la respuesta no se mostró.
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-agricola-status-safe" />
                    Validador determinista: cada respuesta se revisa antes de salir al canal.
                  </>
                )}
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* --- Escalera ------------------------------------------------------ */}
        <TabsContent value="escalera" className="mt-2 min-h-0 flex-1">
          <Card className="flex h-full flex-col border-agricola-border shadow-subtle">
            <CardHeader className="gap-1 pb-2">
              <CardTitle className="text-[14px] text-agricola-dark">Escalera de opciones</CardTitle>
              <CardDescription className="text-[12.5px]">
                El agente siempre ofrece el escalón más bajo que resuelve el caso. Lo de arriba
                queda en reserva, no se muestra.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pb-4">
              <ol className="flex flex-col gap-1">
                {ESCALERA.map((e) => {
                  const activo = escalonActual === e.escalon;
                  const usado = escalonActual !== null && e.escalon < escalonActual;

                  return (
                    <li key={e.id}>
                      <motion.div
                        layout
                        animate={{ opacity: activo ? 1 : usado ? 0.75 : 0.4 }}
                        transition={{ duration: 0.3 }}
                        className={cn(
                          "relative flex items-start gap-2.5 rounded-lg border px-2.5 py-2",
                          activo
                            ? "border-agricola-yellow bg-agricola-yellow-light"
                            : "border-transparent",
                        )}
                      >
                        {activo && (
                          <motion.span
                            layoutId="marca-escalon"
                            className="absolute -left-[1px] top-2 bottom-2 w-[3px] rounded-full bg-agricola-yellow-dark"
                          />
                        )}
                        <span
                          className={cn(
                            "mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                            activo
                              ? "bg-agricola-yellow-dark text-white"
                              : "bg-agricola-bg-alt text-agricola-dark-subtle",
                          )}
                        >
                          {e.escalon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium leading-[17px] text-agricola-dark">
                            {e.titulo}
                          </span>
                          <span className="block text-[11.5px] leading-[16px] text-agricola-dark-muted">
                            {e.cuando}
                          </span>
                        </span>
                        <Badge
                          variant="secondary"
                          className="shrink-0 bg-agricola-bg-alt text-[10px] font-normal text-agricola-dark-muted hover:bg-agricola-bg-alt"
                        >
                          {e.costoBanco === "ninguno" ? "$0" : `costo ${e.costoBanco}`}
                        </Badge>
                      </motion.div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Expediente ---------------------------------------------------- */}
        <TabsContent value="expediente" className="mt-2 min-h-0 flex-1">
          <Card className="flex h-full flex-col border-agricola-border shadow-subtle">
            <CardHeader className="gap-1 pb-2">
              <CardTitle className="text-[14px] text-agricola-dark">{escenario.nombre}</CardTitle>
              <CardDescription className="text-[12.5px]">{escenario.resumen}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto pb-4">
              <dl className="flex flex-col">
                {escenario.perfil.map((fila, i) => (
                  <div
                    key={fila.campo}
                    className={cn(
                      "flex items-baseline justify-between gap-4 py-2",
                      i > 0 && "border-t border-agricola-border-light",
                    )}
                  >
                    <dt className="text-[12.5px] text-agricola-dark-muted">{fila.campo}</dt>
                    <dd className="text-[13px] font-medium tabular-nums text-agricola-dark">
                      {fila.valor}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 rounded-lg bg-agricola-blue-light px-3 py-2 text-[12px] leading-[17px] text-agricola-blue">
                Los datos financieros salen de consultas tipadas, no del modelo. El modelo decide
                cómo se dicen; nunca cuánto se debe.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
