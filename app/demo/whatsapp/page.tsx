"use client";

import { Hand, Pause, Play, RotateCcw, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ConsolaBanco } from "@/components/demo/ConsolaBanco";
import { HiloWhatsapp } from "@/components/whatsapp/HiloWhatsapp";
import { Telefono } from "@/components/whatsapp/Telefono";
import type { AccionCliente, ElementoHilo, Mensaje } from "@/components/whatsapp/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ESCENARIOS,
  escenarioPorSlug,
  type Evento,
  type MetricasTurno,
  type PasoConsola,
} from "@/lib/demo/guion-whatsapp";
import { cn } from "@/lib/utils";

/**
 * Demo del canal de WhatsApp.
 *
 * El reproductor no sabe nada de cobranza: recorre los eventos del guion y los
 * empuja al hilo. Toda la inteligencia del caso vive en `lib/demo/guion-whatsapp`
 * y toda la presentación en `components/whatsapp`. El día que se enchufe el
 * agente real, lo único que cambia es de dónde vienen los eventos.
 *
 * Dos modos:
 *   manual — el guion se detiene en cada mensaje interactivo y espera el toque.
 *            Es el modo para presentar en vivo.
 *   auto   — se resuelve solo. Es el modo para dejarlo corriendo en una pantalla.
 */

type Espera = Extract<Evento, { clase: "espera" }>;

export default function PaginaDemoWhatsapp() {
  const [slug, setSlug] = useState("karla");
  const escenario = escenarioPorSlug(slug);
  const eventos = escenario.eventos;

  const [elementos, setElementos] = useState<ElementoHilo[]>([]);
  const [indice, setIndice] = useState(0);
  const [escribiendo, setEscribiendo] = useState(false);
  const [pasos, setPasos] = useState<PasoConsola[]>([]);
  const [metricas, setMetricas] = useState<MetricasTurno | null>(null);
  const [escalon, setEscalon] = useState<number | null>(null);
  const [turnos, setTurnos] = useState(0);
  const [esperando, setEsperando] = useState<Espera | null>(null);
  const [corriendo, setCorriendo] = useState(true);
  const [manual, setManual] = useState(true);
  const [anotar, setAnotar] = useState(false);
  const [rapido, setRapido] = useState(false);

  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const contadorLibre = useRef(0);
  const velocidad = rapido ? 2.2 : 1;

  const limpiarTemporizadores = () => {
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
  };

  const programar = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    temporizadores.current.push(t);
    return t;
  }, []);

  /** Idempotente a propósito: en desarrollo React monta los efectos dos veces. */
  const empujar = useCallback((elemento: ElementoHilo) => {
    setElementos((prev) => (prev.some((e) => e.id === elemento.id) ? prev : [...prev, elemento]));
  }, []);

  const empujarPasos = useCallback((nuevos: readonly PasoConsola[]) => {
    setPasos((prev) => {
      const faltantes = nuevos.filter((n) => !prev.some((p) => p.id === n.id));
      return faltantes.length === 0 ? prev : [...prev, ...faltantes];
    });
  }, []);

  /** Los mensajes del cliente suben por los checks: enviando → entregado → leído. */
  const empujarMensajeCliente = useCallback(
    (mensaje: Mensaje) => {
      empujar({ clase: "mensaje", ...mensaje, estado: "enviando" });
      programar(
        () =>
          setElementos((prev) =>
            prev.map((e) =>
              e.clase === "mensaje" && e.id === mensaje.id ? { ...e, estado: "entregado" } : e,
            ),
          ),
        600 / velocidad,
      );
      programar(
        () =>
          setElementos((prev) =>
            prev.map((e) =>
              e.clase === "mensaje" && e.id === mensaje.id ? { ...e, estado: "leido" } : e,
            ),
          ),
        1400 / velocidad,
      );
    },
    [empujar, programar, velocidad],
  );

  /* --- Reinicio al cambiar de escenario ---------------------------------- */
  useEffect(() => {
    limpiarTemporizadores();
    setElementos([]);
    setIndice(0);
    setPasos([]);
    setMetricas(null);
    setEscalon(null);
    setTurnos(0);
    setEsperando(null);
    setEscribiendo(false);
    setCorriendo(true);
    contadorLibre.current = 0;
  }, [slug]);

  /* --- Motor del guion ---------------------------------------------------- */
  useEffect(() => {
    if (!corriendo || esperando) return;
    const evento = eventos[indice];
    if (!evento) return;

    const locales: ReturnType<typeof setTimeout>[] = [];
    const enEspera = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      locales.push(t);
      return t;
    };

    // Armar una espera es instantáneo: la pausa la pone la persona, no el guion.
    const retardo = evento.clase === "espera" ? 0 : evento.espera;

    enEspera(() => {
      if (evento.clase === "marcador") {
        empujar(evento.elemento);
        setIndice((i) => i + 1);
        return;
      }

      if (evento.clase === "cliente") {
        empujarMensajeCliente(evento.mensaje);
        setIndice((i) => i + 1);
        return;
      }

      if (evento.clase === "espera") {
        setEsperando(evento);
        return;
      }

      // Turno del agente: el "escribiendo…" del canal corre en paralelo con el
      // razonamiento que se va escribiendo en la consola del banco.
      setEscribiendo(true);
      const pensando = evento.pensando / velocidad;
      evento.pasos.forEach((paso, i) => {
        const cuando = (pensando / (evento.pasos.length + 1)) * (i + 1);
        enEspera(() => empujarPasos([paso]), cuando);
      });

      enEspera(() => {
        setEscribiendo(false);
        empujar({ clase: "mensaje", ...evento.mensaje });
        setMetricas(evento.metricas);
        if (evento.metricas.escalon) setEscalon(evento.metricas.escalon);
        if (evento.metricas.tokensIn > 0) setTurnos((t) => t + 1);
        setIndice((i) => i + 1);
      }, pensando);
    }, retardo / velocidad);

    return () => locales.forEach(clearTimeout);
  }, [
    indice,
    corriendo,
    esperando,
    eventos,
    velocidad,
    empujar,
    empujarPasos,
    empujarMensajeCliente,
  ]);

  /* --- Resolución de una interacción -------------------------------------- */
  const resolver = useCallback(
    (espera: Espera) => {
      const accion = espera.accion;

      if (accion.tipo === "encuesta") {
        setElementos((prev) =>
          prev.map((e) => {
            if (e.clase !== "mensaje" || e.id !== espera.sobre || e.tipo !== "encuesta") return e;
            if (e.votado) return e;
            return {
              ...e,
              votado: accion.opcionId,
              opciones: e.opciones.map((o) =>
                o.id === accion.opcionId ? { ...o, votos: o.votos + 1 } : o,
              ),
            };
          }),
        );
      } else if (accion.tipo === "reaccion") {
        setElementos((prev) =>
          prev.map((e) =>
            e.clase === "mensaje" && e.id === espera.sobre ? { ...e, reaccion: accion.emoji } : e,
          ),
        );
      } else if (espera.respuesta) {
        empujarMensajeCliente(espera.respuesta);
      }

      if (espera.pasos) empujarPasos(espera.pasos);
      setEsperando(null);
      setIndice((i) => i + 1);
    },
    [empujarMensajeCliente, empujarPasos],
  );

  /* --- Modo automático: resuelve la espera solo --------------------------- */
  useEffect(() => {
    if (!esperando || manual || !corriendo) return;
    const t = setTimeout(() => resolver(esperando), esperando.autoMs / velocidad);
    return () => clearTimeout(t);
  }, [esperando, manual, corriendo, velocidad, resolver]);

  /* --- Respuesta segura cuando se sale del guion -------------------------- */
  const responderFueraDeGuion = useCallback(() => {
    setEscribiendo(true);
    programar(() => {
      contadorLibre.current += 1;
      setEscribiendo(false);
      empujar({
        clase: "mensaje",
        id: `libre-a-${contadorLibre.current}`,
        autor: "agente",
        hora: "ahora",
        tipo: "texto",
        anotacion: "text · respuesta segura",
        texto: escenario.fueraDeGuion,
      });
      empujarPasos([
        {
          id: `libre-p-${contadorLibre.current}`,
          tipo: "guardrail",
          etiqueta: "Mensaje fuera del guion",
          detalle:
            "El agente no improvisa datos: devuelve la respuesta segura y ofrece un humano. La conversación no avanza.",
        },
      ]);
    }, 1600 / velocidad);
  }, [empujar, empujarPasos, escenario.fueraDeGuion, programar, velocidad]);

  const alAccionar = (idMensaje: string, accion: AccionCliente) => {
    if (!esperando || esperando.sobre !== idMensaje) return;

    const esperada = esperando.accion;
    const coincide =
      accion.tipo !== esperada.tipo
        ? false
        : accion.tipo === "boton" && esperada.tipo === "boton"
          ? accion.botonId === esperada.botonId
          : accion.tipo === "lista" && esperada.tipo === "lista"
            ? accion.filaId === esperada.filaId
            : true;

    if (coincide) {
      resolver(esperando);
      return;
    }

    // Camino no previsto: se muestra tal cual y el agente responde seguro.
    contadorLibre.current += 1;
    const etiqueta =
      accion.tipo === "boton" ? accion.botonId.replace(/_/g, " ") : "opción no prevista";
    empujarMensajeCliente({
      id: `libre-c-${contadorLibre.current}`,
      autor: "cliente",
      hora: "ahora",
      tipo: "texto",
      texto: etiqueta,
    });
    responderFueraDeGuion();
  };

  const alEnviarTexto = (texto: string) => {
    contadorLibre.current += 1;
    empujarMensajeCliente({
      id: `libre-c-${contadorLibre.current}`,
      autor: "cliente",
      hora: "ahora",
      tipo: "texto",
      texto,
    });
    responderFueraDeGuion();
  };

  const reiniciar = () => {
    limpiarTemporizadores();
    setElementos([]);
    setIndice(0);
    setPasos([]);
    setMetricas(null);
    setEscalon(null);
    setTurnos(0);
    setEsperando(null);
    setEscribiendo(false);
    setCorriendo(true);
    contadorLibre.current = 0;
  };

  useEffect(() => limpiarTemporizadores, []);

  const guardrails = pasos.filter((p) => p.tipo === "guardrail").length;
  const avance = eventos.length === 0 ? 0 : Math.round((indice / eventos.length) * 100);
  const terminado = indice >= eventos.length;

  return (
    <main className="min-h-screen bg-[#0d1418] text-white">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-5 py-6">
        {/* --- Cabecera ----------------------------------------------------- */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              {/* Placa blanca: el archivo whitefont del repo está vacío (sin paths),
                  así que se usa el logo negro sobre un fondo claro también acá. */}
              <span className="flex items-center rounded-md bg-white px-2 py-1">
                <img
                  src="/bancoagricola_blackfont_logo.svg"
                  alt="Bancoagrícola"
                  className="h-[14px] w-auto"
                />
              </span>
              <span className="rounded-full bg-agricola-yellow/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-agricola-yellow">
                Cobranza preventiva
              </span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              El canal es una conversación de WhatsApp
            </h1>
            <p className="mt-0.5 max-w-2xl text-[13px] leading-[18px] text-white/55">
              A la izquierda, lo único que ve la persona. A la derecha, lo que el banco ve al mismo
              tiempo: la señal, el razonamiento y cada guardrail aplicado antes de que salga el
              mensaje.
            </p>
          </div>

          <ToggleGroup
            type="single"
            value={slug}
            onValueChange={(v) => v && setSlug(v)}
            className="gap-1.5 rounded-xl bg-white/[0.06] p-1.5"
          >
            {ESCENARIOS.map((e) => (
              <ToggleGroupItem
                key={e.slug}
                value={e.slug}
                aria-label={e.nombre}
                className="h-auto flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left text-white/60 hover:bg-white/10 hover:text-white data-[state=on]:bg-agricola-yellow data-[state=on]:text-agricola-dark"
              >
                <span className="text-[13px] font-semibold leading-tight">
                  {e.nombre.split(" ")[0]}
                </span>
                <span className="text-[10.5px] font-normal leading-tight opacity-80">
                  {e.etiqueta}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </header>

        {/* --- Barra de control ---------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-white/[0.05] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setCorriendo((c) => !c)}
              disabled={terminado}
              className="h-8 gap-1.5 bg-agricola-yellow text-agricola-dark hover:bg-agricola-yellow-hover"
            >
              {corriendo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {corriendo ? "Pausar" : "Reproducir"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={reiniciar}
              className="h-8 gap-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRapido((r) => !r)}
              className={cn(
                "h-8 gap-1.5 hover:bg-white/10",
                rapido ? "text-agricola-yellow" : "text-white/50 hover:text-white",
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              {rapido ? "2.2×" : "1×"}
            </Button>
          </div>

          <Progress
            value={avance}
            className="h-1 w-[120px] shrink-0 bg-white/10 [&>div]:bg-agricola-yellow"
          />

          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={manual} onCheckedChange={setManual} />
            <span className="flex items-center gap-1.5 text-[12.5px] text-white/70">
              <Hand className="h-3.5 w-3.5" />
              Modo manual
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={anotar} onCheckedChange={setAnotar} />
            <span className="text-[12.5px] text-white/70">Modo inspección · tipos de la API</span>
          </label>

          {/* Pista de la interacción esperada */}
          <div className="ml-auto min-h-[34px] min-w-[240px] flex-1">
            <AnimatePresence mode="wait">
              {manual && esperando && (
                <motion.p
                  key={esperando.sobre}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2 rounded-lg bg-agricola-yellow/15 px-3 py-2 text-[12.5px] text-agricola-yellow"
                >
                  <motion.span
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    className="block h-1.5 w-1.5 shrink-0 rounded-full bg-agricola-yellow"
                  />
                  {esperando.pista}
                </motion.p>
              )}
              {terminado && !esperando && (
                <motion.p
                  key="fin"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-agricola-brand-green/15 px-3 py-2 text-[12.5px] text-agricola-brand-green"
                >
                  Escenario completo. Escribí algo en la barra del teléfono para ver qué hace el
                  agente fuera del guion.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* --- Escenario ----------------------------------------------------- */}
        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          {/* Teléfono */}
          <div className="flex flex-col items-center">
            <Telefono>
              <HiloWhatsapp
                elementos={elementos}
                escribiendo={escribiendo}
                idArmado={manual && esperando ? esperando.sobre : null}
                reaccionSugerida={
                  manual && esperando?.accion.tipo === "reaccion"
                    ? esperando.accion.emoji
                    : undefined
                }
                anotar={anotar}
                nombreContacto="Bancoagrícola"
                horaTelefono={escenario.horaTelefono}
                onAccion={alAccionar}
                onEnviarTexto={alEnviarTexto}
              />
            </Telefono>

          </div>

          {/* Consola */}
          <div className="alto-demo-marco min-h-[520px] rounded-2xl bg-agricola-bg p-3">
            <ConsolaBanco
              escenario={escenario}
              pasos={pasos}
              pensando={escribiendo}
              metricas={metricas}
              escalonActual={escalon}
              turnos={turnos}
              guardrails={guardrails}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
