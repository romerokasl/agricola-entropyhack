"use client";

import { useEffect, useRef, useState } from "react";

import type { Apertura } from "@/lib/agent/types";

/**
 * Hilo de conversación estilo WhatsApp. El banco recomendó explícitamente que el
 * mockup se parezca a WhatsApp.
 *
 * Regla de diseño: el cliente NUNCA ve rojo. Rojo = vergüenza = evasión, y el reto
 * pide empatía. El rojo vive solo en la consola interna del banco.
 */

interface Mensaje {
  rol: "agente" | "cliente";
  texto: string;
}

interface RespuestaApi {
  success: boolean;
  data?: {
    conversacionId: string;
    cliente?: { nombre: string };
    turnos: Mensaje[];
    cerrada?: boolean;
  };
  error?: { code: string; message: string };
}

export default function ChatThread({ slug, apertura }: { slug: string; apertura: Apertura }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [borrador, setBorrador] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const [cerrada, setCerrada] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const iniciado = useRef(false);
  const finDelHilo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;

    const iniciar = async () => {
      setEscribiendo(apertura === "agente");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "iniciar", slug, apertura }),
        });
        const json = (await res.json()) as RespuestaApi;
        if (!json.success || !json.data) {
          setAviso(json.error?.message ?? "No se pudo iniciar la conversación.");
          return;
        }
        setConversacionId(json.data.conversacionId);
        setMensajes(json.data.turnos);
      } catch {
        setAviso("No se pudo conectar con el servicio.");
      } finally {
        setEscribiendo(false);
      }
    };

    void iniciar();
  }, [slug, apertura]);

  useEffect(() => {
    finDelHilo.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, escribiendo]);

  const enviar = async () => {
    const texto = borrador.trim();
    if (texto.length === 0 || !conversacionId || escribiendo || cerrada) return;

    setMensajes((prev) => [...prev, { rol: "cliente", texto }]);
    setBorrador("");
    setEscribiendo(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "mensaje", conversacionId, texto }),
      });
      const json = (await res.json()) as RespuestaApi;
      if (!json.success || !json.data) {
        setAviso(json.error?.message ?? "No se pudo enviar el mensaje.");
        return;
      }
      setMensajes((prev) => [...prev, ...json.data!.turnos]);
      if (json.data.cerrada) setCerrada(true);
    } catch {
      setAviso("No se pudo conectar con el servicio.");
    } finally {
      setEscribiendo(false);
    }
  };

  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col bg-agricola-bg">
      <header className="flex items-center gap-3 bg-agricola-dark px-4 py-3 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-agricola-yellow text-sm font-bold text-agricola-dark">
          BA
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Bancoagrícola</p>
          <p className="text-xs text-agricola-dark-subtle">Asistente de acompañamiento</p>
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

        {escribiendo && (
          <div className="flex justify-start">
            <p className="rounded-card bg-agricola-bg-white px-3 py-2 text-sm text-agricola-dark-subtle shadow-subtle">
              escribiendo…
            </p>
          </div>
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

      <div className="flex items-center gap-2 border-t border-agricola-border bg-agricola-bg-white px-3 py-3">
        <input
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void enviar();
          }}
          disabled={cerrada || conversacionId === null}
          placeholder={cerrada ? "Conversación cerrada" : "Escribí un mensaje"}
          className="flex-1 rounded-button border border-agricola-border px-3 py-2 text-sm text-agricola-dark outline-none focus:border-agricola-brand-green disabled:bg-agricola-bg-alt"
        />
        <button
          onClick={() => void enviar()}
          disabled={cerrada || escribiendo || borrador.trim().length === 0}
          className="rounded-button bg-agricola-yellow px-4 py-2 text-sm font-semibold text-agricola-dark disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
