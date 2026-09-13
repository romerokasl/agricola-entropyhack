"use client";

import {
  AlertTriangle,
  CircleDollarSign,
  Gauge,
  Handshake,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import {
  duracion,
  entero,
  ETIQUETA_BANDA,
  ETIQUETA_ESTADO,
  ETIQUETA_MOTIVO_CONTACTO,
  etiquetaValidador,
  fecha,
  fraccion,
  ms,
  ORDEN_BANDAS,
  porcentaje,
  SIN_DATO,
  usd,
} from "@/app/dashboard/formato";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ESCALERA, type Escalon } from "@/lib/agent/ladder";
import type { MotivoContacto } from "@/lib/agent/types";
import { pedirResumenDashboard } from "@/lib/dashboard/cliente";
import type { ResumenDashboard } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

import { BarraApilada, BarrasHorizontales, Percentiles, RAMPA_ORDINAL, type Dato } from "./graficos";
import { TablaAuditoria } from "./TablaAuditoria";
import { Aparece, Datos, Kpi, NotaFina, NotaSupuesto, Seccion, Tarjeta } from "./primitivos";

/**
 * Vista completa del dashboard.
 *
 * Recibe el `ResumenDashboard` ya calculado (desde el Server Component) y puede
 * volver a pedirlo a `GET /api/dashboard`. No calcula ninguna métrica: si falta una
 * cifra, se agrega en `lib/dashboard/metricas.ts`, no acá.
 */

const COLOR_ESTADO = {
  cerrada_con_acuerdo: "var(--viz-ok)",
  cerrada_sin_acuerdo: "var(--viz-espera)",
  escalada_humano: "var(--viz-info)",
  abierta: "var(--viz-neutro)",
} as const;

/** El costo para el banco ordena la rampa: claro = gratis, oscuro = caro. */
const COLOR_COSTO: Record<Escalon["costoBanco"], string> = {
  ninguno: RAMPA_ORDINAL[0],
  bajo: RAMPA_ORDINAL[1],
  medio: RAMPA_ORDINAL[2],
  alto: RAMPA_ORDINAL[3],
};

const COLOR_BANDA = {
  LOW: RAMPA_ORDINAL[0],
  MODERATE: RAMPA_ORDINAL[1],
  MODERATE_HIGH: RAMPA_ORDINAL[2],
  CRITICAL: RAMPA_ORDINAL[3],
  SIN_BANDA: "var(--viz-neutro)",
} as const;

const INTERVALO_AUTO_MS = 20_000;

export function DashboardVista({ inicial }: { inicial: ResumenDashboard }) {
  const [resumen, setResumen] = useState(inicial);
  const [cargando, setCargando] = useState(false);
  const [errorRefresco, setErrorRefresco] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);

  const refrescar = useCallback(async () => {
    setCargando(true);
    try {
      setResumen(await pedirResumenDashboard());
      setErrorRefresco(null);
    } catch (e: unknown) {
      setErrorRefresco(e instanceof Error ? e.message : "No se pudo actualizar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => void refrescar(), INTERVALO_AUTO_MS);
    return () => clearInterval(t);
  }, [auto, refrescar]);

  const { gestion, cartera, tecnico, provisiones, auditoria } = resumen;
  const { costo } = tecnico;
  const sinConversaciones = gestion.conversaciones.total === 0;

  /* --- Datos derivados solo para pintar (ningún cálculo de métrica) -------- */

  const datosEstado: Dato[] = (
    Object.keys(ETIQUETA_ESTADO) as Array<keyof typeof ETIQUETA_ESTADO>
  ).map((estado) => ({
    clave: estado,
    etiqueta: ETIQUETA_ESTADO[estado],
    cantidad: gestion.conversaciones.porEstado[estado],
    color: COLOR_ESTADO[estado],
  }));

  const datosEscalon: Dato[] = gestion.acuerdosPorEscalon.map((e) => {
    const def = ESCALERA.find((x) => x.id === e.id);
    return {
      clave: e.id,
      etiqueta: `${e.escalon}. ${e.titulo}`,
      cantidad: e.cantidad,
      color: def ? COLOR_COSTO[def.costoBanco] : RAMPA_ORDINAL[0],
      ayuda: def ? `Costo para el banco: ${def.costoBanco}. ${def.cuando}.` : undefined,
    };
  });

  const datosBanda: Dato[] = ORDEN_BANDAS.map((b) => ({
    clave: b,
    etiqueta: ETIQUETA_BANDA[b],
    cantidad: cartera.porBanda[b],
    color: COLOR_BANDA[b],
  }));

  const datosMotivoContacto: Dato[] = (
    Object.keys(ETIQUETA_MOTIVO_CONTACTO) as MotivoContacto[]
  ).map((m) => ({
    clave: m,
    etiqueta: ETIQUETA_MOTIVO_CONTACTO[m],
    cantidad: cartera.requierenContacto.porMotivo[m],
  }));

  return (
    <TooltipProvider delayDuration={120}>
      <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-5 py-7">
        {/* --- Cabecera ------------------------------------------------------ */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-agricola-blue">
              Bancoagrícola · consola interna
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-agricola-dark">
              Dashboard de cobranza preventiva
            </h1>
            <p className="mt-1 text-[13px] text-agricola-dark-muted">
              Calculado desde Supabase el {fecha(resumen.generadoEn)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAuto((a) => !a)}
              className={cn(
                "h-9 border-agricola-border bg-agricola-bg-white text-[13px]",
                auto && "border-agricola-blue text-agricola-blue",
              )}
            >
              <span
                className={cn(
                  "mr-2 inline-block h-1.5 w-1.5 rounded-full",
                  auto ? "animate-pulse bg-viz-ok" : "bg-agricola-dark-subtle",
                )}
              />
              {auto ? `Auto cada ${INTERVALO_AUTO_MS / 1000}s` : "Auto-actualizar"}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => void refrescar()}
              disabled={cargando}
              className="h-9 bg-agricola-blue text-[13px] text-white hover:bg-agricola-blue-hover"
            >
              <RefreshCw className={cn("mr-2 h-3.5 w-3.5", cargando && "animate-spin")} />
              {cargando ? "Actualizando…" : "Actualizar"}
            </Button>
          </div>
        </header>

        <AnimatePresence>
          {errorRefresco && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-lg border border-agricola-status-alert bg-agricola-status-alert-bg px-3 py-2 text-[13px] text-viz-alerta"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No se pudo actualizar: {errorRefresco}. Se siguen mostrando los últimos datos
              cargados.
            </motion.p>
          )}
        </AnimatePresence>

        {sinConversaciones && (
          <NotaSupuesto>
            Todavía no hay conversaciones registradas (la base se vacía con{" "}
            <code className="font-mono">npm run demo:reset</code>). Las métricas de gestión y las
            técnicas aparecen en cuanto se abra la primera. La cartera sí se calcula ya.
          </NotaSupuesto>
        )}

        {/* --- Fila de titulares --------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Aparece indice={0}>
            <Kpi
              etiqueta="Cierre con acuerdo"
              textoDirecto={porcentaje(gestion.cierreConAcuerdo)}
              tono={gestion.cierreConAcuerdo.valor === null ? "neutro" : "ok"}
              icono={<Handshake className="h-4 w-4" />}
              detalle={`${fraccion(gestion.cierreConAcuerdo)} conversaciones cerradas. No cuenta las abiertas.`}
            />
          </Aparece>

          <Aparece indice={1}>
            <Kpi
              etiqueta="Cuotas protegidas"
              valor={gestion.cuotasProtegidas.montoUsd}
              formato={usd}
              icono={<ShieldCheck className="h-4 w-4" />}
              detalle={`${gestion.cuotasProtegidas.clientes} cliente(s) con acuerdo. Cada cliente cuenta una vez, aunque tenga varios ensayos.`}
            />
          </Aparece>

          <Aparece indice={2}>
            <Kpi
              etiqueta="Requieren contacto"
              valor={cartera.requierenContacto.total}
              formato={entero}
              icono={<Target className="h-4 w-4" />}
              detalle={`De ${entero(cartera.totalClientes)} clientes en cartera, con la misma regla con la que el agente decide abrir.`}
            />
          </Aparece>

          <Aparece indice={3}>
            <Kpi
              etiqueta="Latencia del agente (p95)"
              textoDirecto={ms(tecnico.latenciaAgenteMs.p95)}
              icono={<Gauge className="h-4 w-4" />}
              detalle={`n = ${tecnico.latenciaAgenteMs.n} turnos · mediana ${ms(tecnico.latenciaAgenteMs.p50)}`}
            />
          </Aparece>
        </div>

        {/* --- Provisión evitada (el supuesto va pegado a la cifra) ---------- */}
        <Aparece indice={4}>
          <Tarjeta className="border-agricola-blue/20 bg-agricola-blue-light">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-[220px]">
                <p className="flex items-center gap-2 text-[12.5px] font-medium uppercase tracking-wide text-agricola-blue">
                  <CircleDollarSign className="h-4 w-4" />
                  Reserva evitada estimada (NCB-022)
                </p>
                <p className="mt-2 text-[34px] font-semibold leading-none tabular-nums text-agricola-blue">
                  {usd(provisiones.reservaEvitadaUsd)}
                </p>
                <p className="mt-1.5 text-[12px] text-agricola-dark-muted">
                  Sobre {entero(provisiones.clientes)} cliente(s) con acuerdo.
                </p>
              </div>
              <p className="max-w-xl flex-1 text-[12.5px] leading-relaxed text-agricola-dark-muted">
                <span className="font-medium text-agricola-dark">Es un escenario, no una medición. </span>
                {provisiones.supuesto}
              </p>
            </div>
          </Tarjeta>
        </Aparece>

        {/* --- Paneles -------------------------------------------------------- */}
        <Tabs defaultValue="gestion" className="flex flex-col gap-5">
          <TabsList className="w-full justify-start gap-1 overflow-x-auto bg-agricola-bg-alt p-1">
            {[
              ["gestion", "Gestión"],
              ["cartera", "Cartera"],
              ["tecnico", "Solidez técnica"],
              ["auditoria", `Auditoría (${auditoria.length})`],
              ["pendientes", "Sin instrumentar"],
            ].map(([v, etiqueta]) => (
              <TabsTrigger
                key={v}
                value={v}
                className="text-[13px] data-[state=active]:bg-agricola-bg-white data-[state=active]:text-agricola-blue data-[state=active]:shadow-subtle"
              >
                {etiqueta}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* --- Gestión ----------------------------------------------------- */}
          <TabsContent value="gestion" className="mt-0 flex flex-col gap-7">
            <Seccion titulo="Resultado de la gestión">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Tarjeta
                  titulo="Conversaciones por estado"
                  nota={`${entero(gestion.conversaciones.total)} en total · texto ${entero(gestion.conversaciones.porCanal.texto)} · voz ${entero(gestion.conversaciones.porCanal.voz)}`}
                >
                  <BarraApilada datos={datosEstado} vacio="Todavía no hay conversaciones." />
                </Tarjeta>

                <Tarjeta titulo="Montos y escalamiento">
                  <Datos
                    items={[
                      ["Cuotas protegidas con acuerdo", usd(gestion.cuotasProtegidas.montoUsd)],
                      ["Monto comprometido en acuerdos", usd(gestion.montoComprometido.montoUsd)],
                      [
                        "Acuerdos con / sin monto",
                        `${gestion.montoComprometido.acuerdosConMonto} / ${gestion.montoComprometido.acuerdosSinMonto}`,
                      ],
                      [
                        "Escalamiento a asesor humano",
                        `${porcentaje(gestion.escalamientoHumano)} (${fraccion(gestion.escalamientoHumano)})`,
                      ],
                    ]}
                  />
                  <NotaFina>
                    Cuotas protegidas suma la cuota de cada cliente con al menos un acuerdo
                    cerrado. Monto comprometido suma `acuerdos.monto`: un débito automático, por
                    ejemplo, no registra monto.
                  </NotaFina>
                </Tarjeta>
              </div>
            </Seccion>

            <Seccion
              titulo="Escalera de opciones acordadas"
              nota="El agente ofrece siempre el escalón más bajo que resuelve el caso. El color es el costo para el banco: más oscuro, más caro."
            >
              <Tarjeta>
                <BarrasHorizontales
                  datos={datosEscalon}
                  mostrarShare
                  vacio="Todavía no hay acuerdos registrados."
                />
              </Tarjeta>
            </Seccion>

            <Seccion titulo="Motivos de no-acuerdo" nota="Texto libre del agente, de mayor a menor.">
              <Tarjeta>
                <BarrasHorizontales
                  datos={gestion.motivosNoAcuerdo.map((c) => ({
                    clave: c.clave,
                    etiqueta: c.clave,
                    cantidad: c.cantidad,
                  }))}
                  vacio="No hay conversaciones cerradas sin acuerdo."
                />
              </Tarjeta>
            </Seccion>
          </TabsContent>

          {/* --- Cartera ----------------------------------------------------- */}
          <TabsContent value="cartera" className="mt-0 flex flex-col gap-7">
            <Seccion
              titulo="Cartera sembrada"
              nota="“Requieren contacto” usa exactamente la misma regla con la que el agente decide abrir una conversación, evaluada a la fecha de este cálculo."
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Tarjeta
                  titulo="Clientes por banda de riesgo"
                  nota={`${entero(cartera.totalClientes)} clientes. “Sin puntaje” es quien todavía no pasó por el scorer.`}
                >
                  <BarrasHorizontales
                    datos={datosBanda}
                    mostrarShare
                    vacio="No hay clientes sembrados."
                  />
                </Tarjeta>

                <Tarjeta
                  titulo={`Requieren contacto: ${entero(cartera.requierenContacto.total)} de ${entero(cartera.totalClientes)}`}
                  nota="Desglose por la señal que dispara el contacto."
                >
                  <BarrasHorizontales
                    datos={datosMotivoContacto}
                    vacio="Ningún cliente requiere contacto hoy."
                  />
                </Tarjeta>
              </div>
            </Seccion>
          </TabsContent>

          {/* --- Técnico ----------------------------------------------------- */}
          <TabsContent value="tecnico" className="mt-0 flex flex-col gap-7">
            <Seccion titulo="Latencia y duración">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Tarjeta
                  titulo="Latencia por turno del agente"
                  nota={`n = ${tecnico.latenciaAgenteMs.n} turnos. Incluye las llamadas a herramientas y el reintento del validador si lo hubo.`}
                >
                  <Percentiles
                    p50={tecnico.latenciaAgenteMs.p50}
                    p95={tecnico.latenciaAgenteMs.p95}
                    max={tecnico.latenciaAgenteMs.max}
                    n={tecnico.latenciaAgenteMs.n}
                    formato={ms}
                    vacio="Todavía no hay turnos del agente medidos."
                  />
                  <NotaFina>Percentiles por nearest-rank: siempre son un valor observado.</NotaFina>
                </Tarjeta>

                <Tarjeta
                  titulo="Duración de la conversación"
                  nota={`n = ${tecnico.duracionConversacionSeg.n} conversaciones cerradas.`}
                >
                  <Percentiles
                    p50={tecnico.duracionConversacionSeg.p50}
                    p95={tecnico.duracionConversacionSeg.p95}
                    max={tecnico.duracionConversacionSeg.max}
                    n={tecnico.duracionConversacionSeg.n}
                    formato={duracion}
                    vacio="Todavía no hay conversaciones cerradas."
                  />
                </Tarjeta>
              </div>
            </Seccion>

            <Seccion titulo="Tokens y costo">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Tokens">
                  <Datos
                    items={[
                      ["Entrada", entero(tecnico.tokens.entrada)],
                      ["Salida", entero(tecnico.tokens.salida)],
                      [
                        "Entrada promedio por conversación",
                        entero(tecnico.tokens.promedioPorConversacion.entrada),
                      ],
                      [
                        "Salida promedio por conversación",
                        entero(tecnico.tokens.promedioPorConversacion.salida),
                      ],
                      ["Turnos con tokens registrados", entero(tecnico.tokens.turnosConTokens)],
                      ["Turnos sin tokens", entero(tecnico.tokens.turnosSinTokens)],
                    ]}
                  />
                </Tarjeta>

                <Tarjeta titulo="Costo estimado">
                  <Datos
                    items={[
                      [
                        "Costo total",
                        costo.turnosCosteados === 0 ? SIN_DATO : usd(costo.totalUsd),
                      ],
                      ["Por conversación", usd(costo.porConversacionUsd)],
                      ["Por acuerdo logrado", usd(costo.porAcuerdoUsd)],
                      ["Turnos costeados", entero(costo.turnosCosteados)],
                      [
                        "Turnos sin precio conocido",
                        costo.turnosSinPrecio === 0
                          ? "0"
                          : `${costo.turnosSinPrecio} (${costo.modelosSinPrecio.join(", ")})`,
                      ],
                    ]}
                  />
                  <NotaFina>
                    Precio de lista del tier pagado al {costo.preciosVigentesAl} (
                    <a
                      href={costo.fuente}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      fuente
                    </a>
                    ). El demo corre en tier gratuito, así que el costo real hoy es $0. Además es un
                    piso: los tokens de razonamiento se cobran pero no quedan registrados en
                    `tokens_out`.
                  </NotaFina>
                </Tarjeta>
              </div>
            </Seccion>

            <Seccion titulo="Validador y modelos">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Tarjeta
                  titulo="Intervenciones del validador"
                  nota={`${porcentaje(tecnico.validador.intervencion)} de los turnos (${fraccion(tecnico.validador.intervencion)}). Cuenta cualquier respuesta que no pasó a la primera, aunque el reintento saliera bien.`}
                >
                  <BarrasHorizontales
                    datos={tecnico.validador.motivos.map((c) => ({
                      clave: c.clave,
                      etiqueta: etiquetaValidador(c.clave),
                      cantidad: c.cantidad,
                      color: "var(--viz-alerta)",
                    }))}
                    vacio="El validador no ha tenido que intervenir."
                  />
                </Tarjeta>

                <Tarjeta titulo="Modelos que atendieron turnos">
                  <BarrasHorizontales
                    datos={tecnico.modelos.map((c) => ({
                      clave: c.clave,
                      etiqueta: c.clave,
                      cantidad: c.cantidad,
                    }))}
                    mostrarShare
                    vacio="Todavía no hay turnos del agente."
                  />
                </Tarjeta>
              </div>
            </Seccion>
          </TabsContent>

          {/* --- Auditoría ---------------------------------------------------- */}
          <TabsContent value="auditoria" className="mt-0">
            <Seccion
              titulo="Auditoría de conversaciones"
              nota="De la más reciente a la más antigua. El nombre viene enmascarado; la transcripción literal está en la ficha de cada conversación."
            >
              <TablaAuditoria filas={auditoria} />
            </Seccion>
          </TabsContent>

          {/* --- Sin instrumentar --------------------------------------------- */}
          <TabsContent value="pendientes" className="mt-0">
            <PanelPendientes />
          </TabsContent>
        </Tabs>
      </main>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------------------- */
/* Métricas que el documento pide y todavía no tienen dato                     */
/* -------------------------------------------------------------------------- */

const PENDIENTES: ReadonlyArray<{ metrica: string; falta: string }> = [
  {
    metrica: "TTFB de voz, barge-in, grabación de audio",
    falta: "El canal de voz todavía no tiene código que emita telemetría.",
  },
  {
    metrica: "Puntaje de empatía, evolución del sentimiento, % de voseo",
    falta: "Requieren un evaluador post-llamada (LLM-as-judge) que no existe.",
  },
  {
    metrica: "Tasa de contactabilidad efectiva",
    falta: "No hay registro de intentos de contacto; hoy solo existen conversaciones abiertas.",
  },
  {
    metrica: "% de PII enmascarado",
    falta: "El enmascaramiento es de presentación, no de persistencia: la transcripción se guarda literal.",
  },
  {
    metrica: "Costo contra call center humano",
    falta: "Falta una referencia con fuente verificable. La cifra de $0.85 que circula no la tiene.",
  },
  {
    metrica: "Telemetría de ML y drift",
    falta: "Existe en GET /api/monitoring, fuera de este contrato. Devuelve datos simulados si el servicio Python no corre.",
  },
];

function PanelPendientes() {
  return (
    <Seccion
      titulo="Métricas pedidas que todavía no se muestran"
      nota="Están en la especificación de métricas pero no tienen dato real detrás. Se listan acá en vez de pintarse con números de relleno: una cifra inventada en una consola de banco es peor que un hueco."
    >
      <Tarjeta>
        <ul className="flex flex-col">
          {PENDIENTES.map((p, i) => (
            <li
              key={p.metrica}
              className={cn(
                "flex flex-col gap-1 py-3 sm:flex-row sm:gap-6",
                i > 0 && "border-t border-agricola-border-light",
              )}
            >
              <span className="w-full shrink-0 text-[13px] font-medium text-agricola-dark sm:w-[320px]">
                {p.metrica}
              </span>
              <span className="text-[12.5px] leading-relaxed text-agricola-dark-muted">
                {p.falta}
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </Seccion>
  );
}
