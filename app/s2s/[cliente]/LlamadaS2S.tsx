"use client";

import { useEffect, useRef, useState } from "react";

import type { Apertura } from "@/lib/agent/types";
import {
  LlamadaRealtime,
  type EstadoLlamada,
  type MetricasTurnoS2S,
} from "@/voice/speech-to-speech/cliente/llamada";

/**
 * Pantalla de la llamada speech-to-speech. Toda la lógica vive en `LlamadaRealtime`; esto
 * solo la muestra.
 *
 * Misma interacción que `/voz/[cliente]` (push-to-talk) para que la comparación entre los
 * dos enfoques sea justa: lo único que cambia es quién genera la voz.
 *
 * Regla heredada del chat: el cliente NUNCA ve rojo.
 */

interface Mensaje {
  rol: "agente" | "cliente";
  texto: string;
}

const ETIQUETA: Record<EstadoLlamada, string> = {
  inactiva: "tocá para empezar la llamada",
  conectando: "conectando…",
  lista: "mantené el botón para hablar",
  escuchando: "te escucho…",
  pensando: "pensando…",
  hablando: "hablando… mantené el botón para interrumpir",
  cerrada: "llamada cerrada",
  colgada: "llamada terminada",
  error: "la llamada se cortó",
};

export default function LlamadaS2S({ slug, apertura }: { slug: string; apertura: Apertura }) {
  const [estado, setEstado] = useState<EstadoLlamada>("inactiva");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<MetricasTurnoS2S | null>(null);

  const llamada = useRef<LlamadaRealtime | null>(null);
  const finDelHilo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nueva = new LlamadaRealtime(slug, apertura, {
      estado: setEstado,
      mensaje: (rol, texto) => setMensajes((prev) => [...prev, { rol, texto }]),
      aviso: setAviso,
      metricas: setMetricas,
    });
    llamada.current = nueva;
    return () => nueva.destruir();
  }, [slug, apertura]);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, estado]);

  const enCurso = estado === "lista" || estado === "escuchando" || estado === "hablando";
  const terminada = estado === "cerrada" || estado === "colgada" || estado === "error";

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col bg-agricola-bg">
      <header className="flex items-center gap-3 bg-agricola-dark px-4 py-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-agricola-yellow text-sm font-bold text-agricola-dark">
          BA
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold">Bancoagrícola</p>
          <p className="text-xs text-agricola-dark-subtle">Llamada · asistente de acompañamiento</p>
        </div>
        {enCurso && (
          <button
            onClick={() => llamada.current?.colgar()}
            className="rounded-button border border-agricola-dark-subtle px-3 py-1 text-xs font-medium text-white"
          >
            Colgar
          </button>
        )}
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

        {estado === "pensando" && (
          <div className="flex justify-start">
            <p className="rounded-card bg-agricola-bg-white px-3 py-2 text-sm text-agricola-dark-subtle shadow-subtle">
              pensando…
            </p>
          </div>
        )}

        {aviso && (
          <p className="rounded-card bg-agricola-yellow-light px-3 py-2 text-center text-xs text-agricola-dark">
            {aviso}
          </p>
        )}

        {estado === "cerrada" && (
          <p className="text-center text-xs font-medium text-agricola-brand-green">Acuerdo registrado</p>
        )}

        <div ref={finDelHilo} />
      </div>

      {metricas && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-agricola-border bg-agricola-bg-white px-3 py-2 text-[11px] text-agricola-dark-subtle">
          <span>ida y vuelta: {metricas.idaYVueltaMs} ms</span>
          <span>validador: {metricas.validadorMs} ms</span>
          <span>hasta que suena: {metricas.hastaQueSuenaMs} ms</span>
          {metricas.intentos > 1 && <span>intentos: {metricas.intentos}</span>}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 border-t border-agricola-border bg-agricola-bg-white px-3 py-4">
        {estado === "inactiva" ? (
          <button
            onClick={() => void llamada.current?.conectar()}
            className="rounded-button bg-agricola-yellow px-5 py-3 text-sm font-semibold text-agricola-dark shadow-subtle"
          >
            Iniciar llamada
          </button>
        ) : (
          <button
            // La captura del puntero mantiene el botón recibiendo el evento aunque el dedo
            // se salga de él mientras la persona habla.
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              void llamada.current?.empezarAHablar();
            }}
            onPointerUp={() => llamada.current?.dejarDeHablar()}
            onPointerCancel={() => llamada.current?.dejarDeHablar()}
            disabled={!enCurso || terminada}
            className={[
              "h-16 w-16 select-none rounded-full text-sm font-semibold shadow-subtle transition",
              estado === "escuchando"
                ? "scale-110 bg-agricola-brand-green text-white"
                : "bg-agricola-yellow text-agricola-dark",
              !enCurso ? "opacity-40" : "",
            ].join(" ")}
          >
            {estado === "escuchando" ? "Soltá" : "Hablá"}
          </button>
        )}
        <p className="text-xs text-agricola-dark-subtle">{ETIQUETA[estado]}</p>
      </div>
    </div>
  );
}
