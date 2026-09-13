"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Apertura } from "@/lib/agent/types";

/**
 * Llamada con el agente: push-to-talk, transcripción visible y latencia por etapa.
 *
 * Fase 1 del pipeline: STT y TTS corren en el navegador (Web Speech API), sin API keys
 * ni backend de audio. El objetivo de esta fase es cerrar el lazo completo —
 * hablar → transcribir → LLM → validador → responder hablando → persistir— para poder
 * medirlo. Los proveedores de verdad (Deepgram, Google TTS) entran en Fase 2 detrás de
 * la misma interfaz, sin tocar esta pantalla.
 *
 * Por qué push-to-talk y no detección automática de fin de turno: el banco aceptó 4–5 s
 * de latencia, así que no hay que pelear milisegundos con un VAD. Un botón elimina
 * cortar a la persona cuando titubea, que es justo el riesgo con alguien bajo estrés
 * financiero.
 *
 * Regla de diseño heredada del chat: el cliente NUNCA ve rojo. Rojo = vergüenza.
 */

interface Mensaje {
  rol: "agente" | "cliente";
  texto: string;
}

interface Metricas {
  latenciaMs: number;
  latenciaSttMs?: number | null;
  latenciaLlmMs?: number;
  validadorOk?: boolean;
}

interface RespuestaApi {
  success: boolean;
  data?: {
    conversacionId: string;
    cliente?: { nombre: string };
    turnos: Mensaje[];
    cerrada?: boolean;
    metricas?: Metricas;
  };
  error?: { code: string; message: string };
}

/** Latencia del último turno, medida de punta a punta en el navegador. */
interface Etapas {
  sttMs: number | null;
  llmMs: number | null;
  ttsMs: number | null;
}

// --- Tipos mínimos de la Web Speech API -------------------------------------
// TypeScript no los incluye en su librería estándar y `AGENTS.md` prohíbe `any`.

interface AlternativaTranscripcion {
  readonly transcript: string;
}

interface ResultadoReconocimiento extends ArrayLike<AlternativaTranscripcion> {
  readonly isFinal: boolean;
}

interface EventoReconocimiento {
  readonly results: ArrayLike<ResultadoReconocimiento>;
}

interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoReconocimiento) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type ConstructorReconocedor = new () => Reconocedor;

function obtenerConstructorReconocedor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Voz en español, lo más cercana posible al centroamericano. La lista del sistema varía
 * por máquina y navegador, así que se degrada en orden en vez de asumir una.
 */
function elegirVoz(): SpeechSynthesisVoice | null {
  const voces = window.speechSynthesis.getVoices();
  const preferidas = ["es-sv", "es-419", "es-mx", "es-us", "es-co", "es-es"];
  for (const etiqueta of preferidas) {
    const voz = voces.find((v) => v.lang.replace("_", "-").toLowerCase() === etiqueta);
    if (voz) return voz;
  }
  return voces.find((v) => v.lang.toLowerCase().startsWith("es")) ?? null;
}

type Estado = "iniciando" | "inactivo" | "escuchando" | "pensando" | "hablando";

const ETIQUETA_ESTADO: Record<Estado, string> = {
  iniciando: "conectando…",
  inactivo: "mantené el botón para hablar",
  escuchando: "te escucho…",
  pensando: "pensando…",
  hablando: "hablando…",
};

export default function LlamadaVoz({ slug, apertura }: { slug: string; apertura: Apertura }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("iniciando");
  const [parcial, setParcial] = useState("");
  const [etapas, setEtapas] = useState<Etapas | null>(null);
  const [cerrada, setCerrada] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [soportado, setSoportado] = useState(true);

  const iniciado = useRef(false);
  const reconocedor = useRef<Reconocedor | null>(null);
  const transcripcion = useRef("");
  const inicioEscucha = useRef(0);
  const conversacionIdRef = useRef<string | null>(null);
  const finDelHilo = useRef<HTMLDivElement>(null);

  /** Reproduce el texto y devuelve el tiempo hasta el primer sonido (ms). */
  const hablar = useCallback((texto: string): Promise<number> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve(0);
        return;
      }
      const enunciado = new SpeechSynthesisUtterance(texto);
      const voz = elegirVoz();
      if (voz) enunciado.voice = voz;
      enunciado.lang = voz?.lang ?? "es-MX";

      const t0 = Date.now();
      let primerSonido = 0;
      enunciado.onstart = () => {
        primerSonido = Date.now() - t0;
      };
      enunciado.onend = () => resolve(primerSonido);
      enunciado.onerror = () => resolve(primerSonido);

      window.speechSynthesis.speak(enunciado);
    });
  }, []);

  const decirTurnoDelAgente = useCallback(
    async (turnos: Mensaje[], llmMs: number | null, sttMs: number | null) => {
      setMensajes((prev) => [...prev, ...turnos]);
      const delAgente = turnos.filter((t) => t.rol === "agente");
      if (delAgente.length === 0) return;

      setEstado("hablando");
      const ttsMs = await hablar(delAgente.map((t) => t.texto).join(" "));
      setEtapas({ sttMs, llmMs, ttsMs });
      setEstado("inactivo");
    },
    [hablar],
  );

  const enviarTexto = useCallback(
    async (texto: string, sttMs: number) => {
      const id = conversacionIdRef.current;
      if (!id) return;

      setMensajes((prev) => [...prev, { rol: "cliente", texto }]);
      setEstado("pensando");

      try {
        const res = await fetch("/api/voz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "mensaje", conversacionId: id, texto, latenciaSttMs: sttMs }),
        });
        const json = (await res.json()) as RespuestaApi;
        if (!json.success || !json.data) {
          setAviso(json.error?.message ?? "No se pudo enviar el mensaje.");
          setEstado("inactivo");
          return;
        }
        if (json.data.cerrada) setCerrada(true);
        await decirTurnoDelAgente(json.data.turnos, json.data.metricas?.latenciaLlmMs ?? null, sttMs);
      } catch {
        setAviso("No se pudo conectar con el servicio.");
        setEstado("inactivo");
      }
    },
    [decirTurnoDelAgente],
  );

  // --- Arranque de la conversación -----------------------------------------
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    if (obtenerConstructorReconocedor() === null) setSoportado(false);

    const iniciar = async () => {
      try {
        const res = await fetch("/api/voz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "iniciar", slug, apertura }),
        });
        const json = (await res.json()) as RespuestaApi;
        if (!json.success || !json.data) {
          setAviso(json.error?.message ?? "No se pudo iniciar la llamada.");
          setEstado("inactivo");
          return;
        }
        setConversacionId(json.data.conversacionId);
        conversacionIdRef.current = json.data.conversacionId;
        await decirTurnoDelAgente(json.data.turnos, json.data.metricas?.latenciaLlmMs ?? null, null);
      } catch {
        setAviso("No se pudo conectar con el servicio.");
        setEstado("inactivo");
      }
    };

    void iniciar();
  }, [slug, apertura, decirTurnoDelAgente]);

  // Las voces del sistema se cargan de forma asíncrona en Chrome: sin este toque,
  // la primera respuesta puede salir con la voz por defecto en inglés.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const precargar = () => window.speechSynthesis.getVoices();
    precargar();
    window.speechSynthesis.addEventListener("voiceschanged", precargar);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", precargar);
  }, []);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, estado]);

  // --- Push-to-talk ---------------------------------------------------------
  const empezarAHablar = useCallback(() => {
    if (estado !== "inactivo" || cerrada || conversacionId === null) return;

    const Constructor = obtenerConstructorReconocedor();
    if (!Constructor) {
      setSoportado(false);
      return;
    }

    // El agente puede estar todavía hablando: callarlo al tomar la palabra.
    window.speechSynthesis.cancel();

    const rec = new Constructor();
    rec.lang = "es-SV";
    rec.continuous = false;
    rec.interimResults = true;
    transcripcion.current = "";
    inicioEscucha.current = Date.now();

    rec.onresult = (e) => {
      let finales = "";
      let provisional = "";
      for (let i = 0; i < e.results.length; i += 1) {
        const resultado = e.results[i];
        const texto = resultado[0]?.transcript ?? "";
        if (resultado.isFinal) finales += texto;
        else provisional += texto;
      }
      if (finales) transcripcion.current = finales;
      setParcial(provisional || finales);
    };

    rec.onerror = (e) => {
      setAviso(
        e.error === "not-allowed"
          ? "Necesito permiso del micrófono para escucharte."
          : "No te alcancé a escuchar. Probá de nuevo.",
      );
    };

    rec.onend = () => {
      const texto = transcripcion.current.trim();
      const sttMs = Date.now() - inicioEscucha.current;
      setParcial("");
      reconocedor.current = null;
      if (texto.length === 0) {
        setEstado("inactivo");
        return;
      }
      void enviarTexto(texto, sttMs);
    };

    reconocedor.current = rec;
    setAviso(null);
    setEstado("escuchando");
    rec.start();
  }, [estado, cerrada, conversacionId, enviarTexto]);

  const dejarDeHablar = useCallback(() => {
    if (estado !== "escuchando") return;
    reconocedor.current?.stop();
  }, [estado]);

  const puedeHablar = estado === "inactivo" && !cerrada && conversacionId !== null && soportado;

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col bg-agricola-bg">
      <header className="flex items-center gap-3 bg-agricola-dark px-4 py-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-agricola-yellow text-sm font-bold text-agricola-dark">
          BA
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Bancoagrícola</p>
          <p className="text-xs text-agricola-dark-subtle">Llamada · asistente de acompañamiento</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {mensajes.map((m, i) => (
          <div key={i} className={m.rol === "cliente" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={[
                "max-w-[80%] whitespace-pre-wrap rounded-card px-3 py-2 text-sm shadow-subtle",
                m.rol === "cliente"
                  ? "bg-agricola-brand-green-soft text-agricola-dark"
                  : "bg-agricola-bg-white text-agricola-dark",
              ].join(" ")}
            >
              {m.texto}
            </p>
          </div>
        ))}

        {parcial && (
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-card bg-agricola-bg-alt px-3 py-2 text-sm italic text-agricola-dark-subtle">
              {parcial}
            </p>
          </div>
        )}

        {(estado === "pensando" || estado === "hablando") && (
          <div className="flex justify-start">
            <p className="rounded-card bg-agricola-bg-white px-3 py-2 text-sm text-agricola-dark-subtle shadow-subtle">
              {ETIQUETA_ESTADO[estado]}
            </p>
          </div>
        )}

        {!soportado && (
          <p className="rounded-card bg-agricola-yellow-light px-3 py-2 text-center text-xs text-agricola-dark">
            Este navegador no reconoce voz. Usá Chrome o Edge, o seguí la conversación por
            escrito en <span className="font-semibold">/chat/{slug}</span>.
          </p>
        )}

        {aviso && (
          <p className="rounded-card bg-agricola-yellow-light px-3 py-2 text-center text-xs text-agricola-dark">
            {aviso}
          </p>
        )}

        {cerrada && (
          <p className="text-center text-xs font-medium text-agricola-brand-green">
            Acuerdo registrado
          </p>
        )}

        <div ref={finDelHilo} />
      </div>

      {etapas && (
        <div className="flex justify-center gap-4 border-t border-agricola-border bg-agricola-bg-white px-3 py-2 text-[11px] text-agricola-dark-subtle">
          <span>voz → texto: {etapas.sttMs === null ? "—" : `${etapas.sttMs} ms`}</span>
          <span>agente: {etapas.llmMs === null ? "—" : `${etapas.llmMs} ms`}</span>
          <span>texto → voz: {etapas.ttsMs === null ? "—" : `${etapas.ttsMs} ms`}</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 border-t border-agricola-border bg-agricola-bg-white px-3 py-4">
        <button
          onPointerDown={empezarAHablar}
          onPointerUp={dejarDeHablar}
          onPointerLeave={dejarDeHablar}
          disabled={!puedeHablar && estado !== "escuchando"}
          className={[
            "h-16 w-16 select-none rounded-full text-sm font-semibold shadow-subtle transition",
            estado === "escuchando"
              ? "scale-110 bg-agricola-brand-green text-white"
              : "bg-agricola-yellow text-agricola-dark",
            !puedeHablar && estado !== "escuchando" ? "opacity-40" : "",
          ].join(" ")}
        >
          {estado === "escuchando" ? "Soltá" : "Hablá"}
        </button>
        <p className="text-xs text-agricola-dark-subtle">
          {cerrada ? "Llamada cerrada" : ETIQUETA_ESTADO[estado]}
        </p>
      </div>
    </div>
  );
}
