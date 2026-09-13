"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import type { Apertura } from "@/lib/agent/types";

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
    transcripcion?: string;
    capacidades?: { sttEnServidor: boolean; ttsEnServidor: boolean };
    hablado?: string;
    audio?: { base64: string; mime: string; latenciaMs: number } | null;
    cerrada?: boolean;
    metricas?: Metricas;
  };
  error?: { code: string; message: string };
}

interface Etapas {
  sttMs: number | null;
  llmMs: number | null;
  ttsMs: number | null;
}

type FaseLlamada = "entrante" | "conectada" | "finalizada";
type EstadoVoz = "iniciando" | "hablando" | "escuchando" | "pensando" | "silenciado";

interface AlternativaTranscripcion {
  readonly transcript: string;
}

interface ResultadoReconocimiento extends ArrayLike<AlternativaTranscripcion> {
  readonly isFinal: boolean;
}

interface EventoReconocimiento {
  readonly resultIndex: number;
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

function elegirVoz(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voces = window.speechSynthesis.getVoices();
  const preferidas = ["es-sv", "es-419", "es-mx", "es-us", "es-co", "es-es"];
  for (const etiqueta of preferidas) {
    const voz = voces.find((v) => v.lang.replace("_", "-").toLowerCase() === etiqueta);
    if (voz) return voz;
  }
  return voces.find((v) => v.lang.toLowerCase().startsWith("es")) ?? null;
}

const NOMBRES_CLIENTES: Record<string, string> = {
  karla: "Karla Menjívar",
  wilber: "Wilber Ramos",
  sandra: "Sandra Beltrán",
  rosa: "Rosa Rivera",
  nelson: "Nelson Gómez",
  jose: "José Portillo",
  tito: "Tito Castillo",
  marta: "Marta Cruz",
};

/**
 * Sintetizador Web Audio API de Timbre Telefónico (Dual Tone 440 Hz + 480 Hz)
 */
class TimbreTelefonico {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sonando = false;

  iniciar() {
    if (this.sonando) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.sonando = true;
      this.tocarCiclo();
      this.timer = setInterval(() => this.tocarCiclo(), 4200);
    } catch {
      // Navegador puede restringir autoplay hasta interacción
    }
  }

  private tocarCiclo() {
    if (!this.ctx || !this.sonando) return;
    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(440, t);
      osc2.frequency.setValueAtTime(480, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.1);
      gain.gain.setValueAtTime(0.14, t + 1.7);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 2.0);
      osc2.stop(t + 2.0);
    } catch {}
  }

  detener() {
    this.sonando = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.ctx.state !== "closed") {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export default function LlamadaVoz({ slug, apertura }: { slug: string; apertura: Apertura }) {
  const [fase, setFase] = useState<FaseLlamada>("entrante");
  const [estadoVoz, setEstadoVoz] = useState<EstadoVoz>("iniciando");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [duracion, setDuracion] = useState(0);
  const [silenciado, setSilenciado] = useState(false);
  const [altavoz, setAltavoz] = useState(true);
  const [mostrarDrawer, setMostrarDrawer] = useState(false);
  const [transcripcionEnVivo, setTranscripcionEnVivo] = useState("");
  const [nivelVolumen, setNivelVolumen] = useState(0);
  const [etapas, setEtapas] = useState<Etapas | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [cerrada, setCerrada] = useState(false);
  const [errorAviso, setErrorAviso] = useState<string | null>(null);

  const nombreCliente = NOMBRES_CLIENTES[slug] ?? slug;

  // Referencias para control de estado sin desincronización
  const estadoVozRef = useRef<EstadoVoz>("iniciando");
  estadoVozRef.current = estadoVoz;

  const timbreRef = useRef<TimbreTelefonico | null>(null);
  const reconocedorRef = useRef<Reconocedor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silencioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textoBufferRef = useRef<string>("");
  const audioActualRef = useRef<HTMLAudioElement | null>(null);
  const conversacionIdRef = useRef<string | null>(null);
  const finLlamadaRef = useRef(false);
  const procesandoRef = useRef(false);
  const inicioHablaAgenteRef = useRef(0);

  conversacionIdRef.current = conversacionId;

  // Iniciar timbre telefónico en fase entrante
  useEffect(() => {
    if (fase === "entrante") {
      const timbre = new TimbreTelefonico();
      timbreRef.current = timbre;
      timbre.iniciar();
      return () => {
        timbre.detener();
      };
    }
  }, [fase]);

  // Cronómetro de llamada
  useEffect(() => {
    if (fase !== "conectada") return;
    const interval = setInterval(() => {
      setDuracion((d) => d + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [fase]);

  const formatoTiempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${mins.toString().padStart(2, "0")}:${segs.toString().padStart(2, "0")}`;
  };

  /**
   * Interrumpe la voz del agente de inmediato
   */
  const interrumpirAgente = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioActualRef.current) {
      audioActualRef.current.pause();
      audioActualRef.current.currentTime = 0;
      audioActualRef.current = null;
    }
  }, []);

  /**
   * Detiene el reconocimiento de voz para no escuchar mientras piensa o habla
   */
  const detenerReconocedor = useCallback(() => {
    if (silencioTimerRef.current) {
      clearTimeout(silencioTimerRef.current);
      silencioTimerRef.current = null;
    }
    if (reconocedorRef.current) {
      try {
        reconocedorRef.current.abort();
      } catch {}
      reconocedorRef.current = null;
    }
  }, []);

  /**
   * Inicia el reconocimiento de voz para el turno del usuario con acumulador completo y VAD
   */
  const activarEscuchaUsuario = useCallback(() => {
    if (finLlamadaRef.current || silenciado || procesandoRef.current) return;

    detenerReconocedor();
    textoBufferRef.current = "";
    setTranscripcionEnVivo("");
    setEstadoVoz("escuchando");

    const Constructor = obtenerConstructorReconocedor();
    if (!Constructor) return;

    try {
      const rec = new Constructor();
      // Idioma estándar latinoamericano de alta precisión en Chrome y Edge
      const navLang = typeof navigator !== "undefined" ? navigator.language : "";
      rec.lang = navLang.toLowerCase().startsWith("es") ? navLang : "es-419";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (evento: EventoReconocimiento) => {
        // Bloqueo estricto si el sistema está procesando o terminó la llamada
        if (procesandoRef.current || finLlamadaRef.current) return;

        // Si el agente estaba hablando, verificar si es un barge-in legítimo
        if (estadoVozRef.current === "hablando") {
          const tiempoHablando = Date.now() - inicioHablaAgenteRef.current;
          // Evitar eco de los primeros 500ms del altavoz
          if (tiempoHablando < 500) return;
        }

        // Reconstrucción completa de la frase acumulada en la sesión actual
        let finales = "";
        let provisional = "";
        for (let i = 0; i < evento.results.length; i++) {
          const res = evento.results[i];
          const trans = res[0]?.transcript ?? "";
          if (res.isFinal) finales += trans + " ";
          else provisional += trans;
        }

        const detectado = (finales + provisional).trim();

        // Filtrar artefactos mínimos (< 2 caracteres)
        if (detectado.length >= 2) {
          // Si el agente hablaba y el cliente empezó a hablar -> Interrumpir al agente de inmediato
          if (estadoVozRef.current === "hablando") {
            interrumpirAgente();
            setEstadoVoz("escuchando");
          }

          textoBufferRef.current = detectado;
          setTranscripcionEnVivo(detectado);

          // Resetear temporizador de silencio conversacional (950ms)
          if (silencioTimerRef.current) {
            clearTimeout(silencioTimerRef.current);
          }

          silencioTimerRef.current = setTimeout(() => {
            const aEnviar = textoBufferRef.current.trim();
            if (aEnviar.length >= 2 && !procesandoRef.current) {
              detenerReconocedor();
              void procesarTurno(aEnviar);
            }
          }, 950);
        }
      };

      rec.onerror = (e) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          console.warn("STT estado:", e.error);
        }
      };

      rec.onend = () => {
        reconocedorRef.current = null;
        // Solo reanudar si todavía debemos estar escuchando y no estamos procesando ni hablando
        if (
          !finLlamadaRef.current &&
          !procesandoRef.current &&
          estadoVozRef.current === "escuchando"
        ) {
          // Re-instanciar limpiamente para que Chromium no falle con InvalidStateError
          setTimeout(() => {
            if (
              !finLlamadaRef.current &&
              !procesandoRef.current &&
              estadoVozRef.current === "escuchando"
            ) {
              activarEscuchaUsuario();
            }
          }, 60);
        }
      };

      rec.start();
      reconocedorRef.current = rec;
    } catch (err) {
      console.error("Error al arrancar STT:", err);
    }
  }, [silenciado, detenerReconocedor, interrumpirAgente]);

  /**
   * Envía el turno a Ollama y procesa la respuesta sin interrupciones
   */
  const procesarTurno = useCallback(
    async (texto: string) => {
      const convId = conversacionIdRef.current;
      if (!convId || !texto.trim() || finLlamadaRef.current) return;

      // Candado de procesamiento
      procesandoRef.current = true;
      detenerReconocedor();
      interrumpirAgente();

      setEstadoVoz("pensando");
      setTranscripcionEnVivo("");

      // Registrar mensaje del cliente en el historial de auditoría
      setMensajes((prev) => [...prev, { rol: "cliente", texto }]);

      const tInicioLlm = Date.now();
      try {
        const res = await fetch("/api/voz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion: "mensaje",
            conversacionId: convId,
            texto,
          }),
        });

        const json = (await res.json()) as RespuestaApi;

        if (!json.success || !json.data) {
          // Auto-recuperación si la conversación se perdió en el servidor
          if (json.error?.message?.includes("no existe")) {
            const reintento = await fetch("/api/voz", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accion: "iniciar", slug, apertura: "cliente" }),
            });
            const jsonReintento = (await reintento.json()) as RespuestaApi;
            if (jsonReintento.success && jsonReintento.data) {
              setConversacionId(jsonReintento.data.conversacionId);
              conversacionIdRef.current = jsonReintento.data.conversacionId;
              procesandoRef.current = false;
              await procesarTurno(texto);
              return;
            }
          }
          setErrorAviso(json.error?.message ?? "Error en el turno");
          procesandoRef.current = false;
          activarEscuchaUsuario();
          return;
        }

        const llmMs = Date.now() - tInicioLlm;
        const ultimoTurno = json.data.turnos.at(-1);
        const textoRespuesta = ultimoTurno?.texto ?? "";

        // Preservar todo el hilo en el cajón de auditoría sin sobreescribirlo
        if (textoRespuesta) {
          setMensajes((prev) => {
            const yaExiste = prev.some(
              (m, idx) => idx === prev.length - 1 && m.rol === "agente" && m.texto === textoRespuesta,
            );
            return yaExiste ? prev : [...prev, { rol: "agente", texto: textoRespuesta }];
          });
        }

        if (json.data.metricas) {
          setMetricas(json.data.metricas);
          setEtapas({
            sttMs: json.data.metricas.latenciaSttMs ?? null,
            llmMs,
            ttsMs: json.data.audio?.latenciaMs ?? null,
          });
        }

        if (json.data.cerrada) {
          setCerrada(true);
        }

        // Reproducir la respuesta del agente
        procesandoRef.current = false;
        if (textoRespuesta) {
          await reproducirVozAgente(json.data.hablado ?? textoRespuesta, json.data.audio);
        } else {
          activarEscuchaUsuario();
        }
      } catch (err) {
        setErrorAviso(err instanceof Error ? err.message : "Falla en comunicación");
        procesandoRef.current = false;
        activarEscuchaUsuario();
      }
    },
    [slug, detenerReconocedor, interrumpirAgente, activarEscuchaUsuario],
  );

  /**
   * Permite enviar el texto reconocido de inmediato sin esperar el silencio
   */
  const enviarTurnoInmediato = useCallback(() => {
    if (procesandoRef.current || finLlamadaRef.current) return;
    const aEnviar = (textoBufferRef.current || transcripcionEnVivo).trim();
    if (aEnviar.length >= 2) {
      if (silencioTimerRef.current) {
        clearTimeout(silencioTimerRef.current);
        silencioTimerRef.current = null;
      }
      detenerReconocedor();
      void procesarTurno(aEnviar);
    }
  }, [transcripcionEnVivo, detenerReconocedor, procesarTurno]);

  /**
   * Reproduce la voz del agente (Piper local o Web Speech API)
   */
  const reproducirVozAgente = useCallback(
    async (texto: string, audio?: { base64: string; mime: string } | null) => {
      setEstadoVoz("hablando");
      inicioHablaAgenteRef.current = Date.now();

      // Audio WAV neuronal de Piper
      if (audio?.base64) {
        return new Promise<void>((resolve) => {
          interrumpirAgente();
          const el = new Audio(`data:${audio.mime};base64,${audio.base64}`);
          audioActualRef.current = el;

          el.onended = () => {
            audioActualRef.current = null;
            if (!finLlamadaRef.current) {
              setTimeout(() => activarEscuchaUsuario(), 300);
            }
            resolve();
          };

          el.onerror = () => {
            audioActualRef.current = null;
            if (!finLlamadaRef.current) activarEscuchaUsuario();
            resolve();
          };

          void el.play().catch(() => {
            hablarNavegador(texto).then(resolve);
          });
        });
      }

      // Síntesis nativa del navegador
      return hablarNavegador(texto);
    },
    [interrumpirAgente, activarEscuchaUsuario],
  );

  const hablarNavegador = (texto: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        if (!finLlamadaRef.current) activarEscuchaUsuario();
        resolve();
        return;
      }
      interrumpirAgente();
      const enunciado = new SpeechSynthesisUtterance(texto);
      const voz = elegirVoz();
      if (voz) enunciado.voice = voz;
      enunciado.lang = voz?.lang ?? "es-MX";
      enunciado.rate = 1.02;

      enunciado.onend = () => {
        if (!finLlamadaRef.current) {
          setTimeout(() => activarEscuchaUsuario(), 300);
        }
        resolve();
      };
      enunciado.onerror = () => {
        if (!finLlamadaRef.current) activarEscuchaUsuario();
        resolve();
      };

      window.speechSynthesis.speak(enunciado);
    });
  };

  /**
   * Inicia el análisis de audio con cancelación de eco para el visualizador
   */
  const iniciarAnalizadorAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        if (finLlamadaRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const promedio = sum / dataArray.length;
        setNivelVolumen(Math.min(100, Math.round((promedio / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) {
      console.warn("Visualizador micrófono:", err);
    }
  }, []);

  /**
   * Contestar llamada entrante
   */
  const contestarLlamada = async () => {
    if (timbreRef.current) {
      timbreRef.current.detener();
    }
    setFase("conectada");
    setEstadoVoz("iniciando");
    finLlamadaRef.current = false;
    procesandoRef.current = true;

    await iniciarAnalizadorAudio();

    try {
      const res = await fetch("/api/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "iniciar", slug, apertura }),
      });
      const json = (await res.json()) as RespuestaApi;

      if (!json.success || !json.data) {
        setErrorAviso(json.error?.message ?? "Error al abrir la sesión");
        procesandoRef.current = false;
        activarEscuchaUsuario();
        return;
      }

      setConversacionId(json.data.conversacionId);
      conversacionIdRef.current = json.data.conversacionId;
      setMensajes(json.data.turnos);

      const saludo = json.data.turnos[0]?.texto;
      procesandoRef.current = false;
      if (saludo) {
        await reproducirVozAgente(json.data.hablado ?? saludo, json.data.audio);
      } else {
        activarEscuchaUsuario();
      }
    } catch (err) {
      setErrorAviso(err instanceof Error ? err.message : "Error al conectar llamada");
      procesandoRef.current = false;
      activarEscuchaUsuario();
    }
  };

  /**
   * Colgar llamada y limpiar recursos
   */
  const colgarLlamada = () => {
    finLlamadaRef.current = true;
    procesandoRef.current = false;
    if (timbreRef.current) timbreRef.current.detener();
    detenerReconocedor();
    interrumpirAgente();

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setFase("finalizada");
  };

  /**
   * Mute / Unmute
   */
  const alternarSilencio = () => {
    const nuevo = !silenciado;
    setSilenciado(nuevo);
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nuevo;
      });
    }
    if (nuevo) {
      detenerReconocedor();
      setEstadoVoz("silenciado");
    } else {
      if (estadoVozRef.current !== "hablando" && estadoVozRef.current !== "pensando") {
        activarEscuchaUsuario();
      }
    }
  };

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      finLlamadaRef.current = true;
      procesandoRef.current = false;
      if (timbreRef.current) timbreRef.current.detener();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (silencioTimerRef.current) clearTimeout(silencioTimerRef.current);
      if (reconocedorRef.current) {
        try {
          reconocedorRef.current.abort();
        } catch {}
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Fondo ambiental dinámico con glassmorphism */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] h-[600px] w-[600px] rounded-full bg-blue-900/20 blur-[130px]" />
        <div className="absolute -bottom-[20%] -right-[10%] h-[600px] w-[600px] rounded-full bg-amber-600/15 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      </div>

      {/* Botón flotante para Drawer de Auditoría del Jurado */}
      <button
        onClick={() => setMostrarDrawer(true)}
        title="Ver telemetría y guardrails para el jurado"
        className="fixed top-5 right-5 z-40 flex items-center gap-2 rounded-full border border-slate-800/80 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur-md transition-all hover:border-amber-500/50 hover:bg-slate-800 hover:text-white hover:shadow-lg hover:shadow-amber-500/10"
      >
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        <span>Telemetría & Guardrails</span>
      </button>

      {/* Frame estilo Smartphone de alta gama */}
      <div className="relative z-10 mx-auto flex h-[820px] w-full max-w-[400px] flex-col justify-between overflow-hidden rounded-[48px] border border-slate-800/80 bg-slate-900/95 p-7 shadow-2xl shadow-black/80 backdrop-blur-xl">
        {/* ========================================================
            FASE 1: PANTALLA DE LLAMADA ENTRANTE (INCOMING CALL)
           ======================================================== */}
        {fase === "entrante" && (
          <div className="flex h-full flex-col justify-between py-6">
            {/* Cabecera de llamada entrante */}
            <div className="mt-8 flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-300 uppercase">
                <PhoneIncoming className="h-3.5 w-3.5 animate-bounce" />
                Llamada Entrante
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                Bancoagrícola
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Acompañamiento Financiero Preventivo
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Cliente: <span className="text-slate-300 font-medium">{nombreCliente}</span>
              </p>
            </div>

            {/* Avatar central con ondas concéntricas palpitantes */}
            <div className="relative my-auto flex items-center justify-center">
              <div className="absolute h-44 w-44 animate-ping rounded-full bg-amber-500/15" />
              <div className="absolute h-56 w-56 animate-pulse rounded-full border border-amber-500/20 bg-blue-600/10" />

              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-amber-400/80 bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900 shadow-2xl shadow-amber-500/20">
                <span className="text-3xl font-black tracking-tighter text-amber-400">
                  BA
                </span>
              </div>
            </div>

            {/* Botones de acción: Rechazar y Contestar */}
            <div className="mb-4 flex items-center justify-around px-4">
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={colgarLlamada}
                  className="group flex h-18 w-18 items-center justify-center rounded-full bg-rose-600/90 text-white shadow-lg shadow-rose-600/30 transition-all hover:scale-105 hover:bg-rose-500 active:scale-95"
                >
                  <PhoneOff className="h-7 w-7 transition-transform group-hover:-rotate-12" />
                </button>
                <span className="text-xs font-medium text-slate-400">Rechazar</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={contestarLlamada}
                  className="group relative flex h-18 w-18 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition-all hover:scale-105 hover:bg-emerald-400 active:scale-95"
                >
                  <span className="absolute -inset-1 animate-pulse rounded-full border border-emerald-400/60" />
                  <Phone className="h-7 w-7 animate-bounce" />
                </button>
                <span className="text-xs font-semibold text-emerald-400">Contestar</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            FASE 2: INTERFAZ EN LLAMADA ACTIVA (CERO CHAT)
           ======================================================== */}
        {fase === "conectada" && (
          <div className="flex h-full flex-col justify-between py-4">
            {/* Top Bar: Info y Cronómetro */}
            <div className="flex flex-col items-center text-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
                Bancoagrícola
              </span>
              <h3 className="mt-1 text-xl font-bold text-white">{nombreCliente}</h3>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 font-mono text-sm font-semibold tracking-wider text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {formatoTiempo(duracion)}
              </div>
            </div>

            {/* Centro: Visualizador de Audio y Avatar con Aura */}
            <div className="relative my-auto flex flex-col items-center justify-center">
              {/* Aura reactiva al volumen y al estado */}
              <div
                className={`absolute rounded-full transition-all duration-300 ${
                  estadoVoz === "hablando"
                    ? "h-56 w-56 bg-amber-500/25 blur-xl animate-pulse"
                    : estadoVoz === "escuchando"
                    ? "h-56 w-56 bg-cyan-500/20 blur-xl"
                    : estadoVoz === "pensando"
                    ? "h-56 w-56 bg-purple-500/20 blur-xl animate-pulse"
                    : "h-44 w-44 bg-slate-800/20 blur-md"
                }`}
                style={{
                  transform: `scale(${1 + nivelVolumen / 180})`,
                }}
              />

              {/* Avatar central interactivo (Tap para interrumpir o Tap para enviar) */}
              <button
                type="button"
                onClick={() => {
                  if (estadoVoz === "hablando") {
                    interrumpirAgente();
                    activarEscuchaUsuario();
                  } else if (estadoVoz === "escuchando" && (transcripcionEnVivo || textoBufferRef.current)) {
                    enviarTurnoInmediato();
                  }
                }}
                className={`relative z-10 flex h-36 w-36 items-center justify-center rounded-full border-2 bg-slate-900 shadow-2xl transition-all duration-300 active:scale-95 ${
                  estadoVoz === "hablando"
                    ? "border-amber-400 cursor-pointer hover:border-amber-300 hover:shadow-amber-500/20"
                    : estadoVoz === "escuchando"
                    ? "border-cyan-400 cursor-pointer hover:border-cyan-300 hover:shadow-cyan-500/20"
                    : estadoVoz === "pensando"
                    ? "border-purple-400 animate-pulse cursor-wait"
                    : "border-slate-700"
                }`}
                title={
                  estadoVoz === "hablando"
                    ? "Tocá para interrumpir al asistente"
                    : estadoVoz === "escuchando" && transcripcionEnVivo
                    ? "Tocá para enviar lo que dijiste ya"
                    : "Asistente de Bancoagrícola"
                }
              >
                <div className="flex flex-col items-center pointer-events-none">
                  <span className="text-3xl font-black text-amber-400 tracking-tighter">
                    BA
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {estadoVoz === "hablando" && "Hablando"}
                    {estadoVoz === "escuchando" && "Escuchando"}
                    {estadoVoz === "pensando" && "Pensando"}
                    {estadoVoz === "silenciado" && "Mudo"}
                    {estadoVoz === "iniciando" && "Conectando"}
                  </span>
                </div>
              </button>

              {/* Estado descriptivo en tiempo real */}
              <div className="mt-6 flex flex-col items-center gap-2 text-center px-4">
                <div className="inline-flex items-center gap-2">
                  {estadoVoz === "pensando" && (
                    <Sparkles className="h-4 w-4 text-purple-400 animate-spin" />
                  )}
                  <p className="text-sm font-semibold tracking-wide text-slate-200">
                    {estadoVoz === "hablando" && "Bancoagrícola hablando…"}
                    {estadoVoz === "escuchando" && "Te escucho, podés hablar libremente…"}
                    {estadoVoz === "pensando" && "Ollama (llama3.1) razonando…"}
                    {estadoVoz === "silenciado" && "Micrófono silenciado"}
                    {estadoVoz === "iniciando" && "Iniciando llamada…"}
                  </p>
                </div>

                {/* Subtítulo dinámico con lo que el usuario habla */}
                {transcripcionEnVivo ? (
                  <div className="flex flex-col items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <p className="max-w-[340px] rounded-xl border border-cyan-500/40 bg-slate-900/95 px-3.5 py-2 text-xs font-medium text-cyan-200 shadow-lg shadow-cyan-950/40 leading-relaxed text-center">
                      &ldquo;{transcripcionEnVivo}&rdquo;
                    </p>
                    {estadoVoz === "escuchando" && (
                      <button
                        type="button"
                        onClick={enviarTurnoInmediato}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition-all hover:bg-cyan-500/30 active:scale-95"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                        <span>Detectando voz · Tocá para enviar ya</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {estadoVoz === "pensando"
                      ? "Evaluando escalón y guardrails de riesgo..."
                      : estadoVoz === "hablando"
                      ? "Podés hablar o tocar el círculo para interrumpir"
                      : "Hablá naturalmente · Envío automático o tocá para enviar"}
                  </p>
                )}
              </div>

              {/* Ondas de audio simuladas estilo teléfono */}
              <div className="mt-6 flex h-8 items-center gap-1.5">
                {[0.4, 0.8, 1.2, 0.6, 1.4, 0.9, 0.5, 1.1, 0.7].map((factor, i) => {
                  const altura =
                    estadoVoz === "hablando"
                      ? 14 + Math.sin(Date.now() / 200 + i) * 12
                      : estadoVoz === "escuchando"
                      ? Math.max(4, (nivelVolumen * factor) / 2.5)
                      : estadoVoz === "pensando"
                      ? 8 + Math.sin(Date.now() / 300 + i) * 6
                      : 4;
                  return (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        estadoVoz === "hablando"
                          ? "bg-amber-400"
                          : estadoVoz === "escuchando"
                          ? "bg-cyan-400"
                          : estadoVoz === "pensando"
                          ? "bg-purple-400"
                          : "bg-slate-700"
                      }`}
                      style={{ height: `${Math.min(32, Math.max(4, altura))}px` }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Aviso de error transitorio si ocurre */}
            {errorAviso && (
              <div className="mx-2 mb-2 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="truncate">{errorAviso}</span>
              </div>
            )}

            {/* Controles telefónicos en la parte inferior */}
            <div className="flex items-center justify-around rounded-3xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-lg">
              {/* Botón Silenciar */}
              <button
                onClick={alternarSilencio}
                title={silenciado ? "Activar micrófono" : "Silenciar micrófono"}
                className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${
                  silenciado
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30"
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {silenciado ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {/* Botón Colgar (Principal) */}
              <button
                onClick={colgarLlamada}
                title="Colgar llamada"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/40 transition-all hover:scale-105 hover:bg-rose-500 active:scale-95"
              >
                <PhoneOff className="h-7 w-7" />
              </button>

              {/* Botón Altavoz */}
              <button
                onClick={() => setAltavoz(!altavoz)}
                title={altavoz ? "Altavoz encendido" : "Altavoz apagado"}
                className={`flex h-13 w-13 items-center justify-center rounded-full transition-all ${
                  altavoz
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-800/40 text-slate-500"
                }`}
              >
                {altavoz ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            FASE 3: PANTALLA DE LLAMADA FINALIZADA
           ======================================================== */}
        {fase === "finalizada" && (
          <div className="my-auto flex flex-col items-center justify-center text-center py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-400">
              <PhoneOff className="h-8 w-8 text-rose-400" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-white">Llamada finalizada</h3>
            <p className="mt-1 text-sm text-slate-400">
              Duración: <span className="font-mono text-slate-200 font-semibold">{formatoTiempo(duracion)}</span>
            </p>

            {cerrada && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Gestión Registrada Exitosamente
              </div>
            )}

            <button
              onClick={() => {
                setDuracion(0);
                setCerrada(false);
                setMensajes([]);
                setTranscripcionEnVivo("");
                setFase("entrante");
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-300 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              Simular Otra Llamada
            </button>
          </div>
        )}
      </div>

      {/* ========================================================
          CAJÓN LATERAL DE AUDITORÍA Y TELEMETRÍA (PARA EL JURADO)
         ======================================================== */}
      {mostrarDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-950 p-6 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Cabecera del Drawer */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Terminal className="h-5 w-5" />
                <h4 className="font-bold text-slate-100">Telemetría de Llamada</h4>
              </div>
              <button
                onClick={() => setMostrarDrawer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tarjetas de latencia y guardrails */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">STT</span>
                <p className="mt-1 font-mono text-xs font-bold text-cyan-300">
                  {etapas?.sttMs ? `${etapas.sttMs} ms` : "Navegador"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Ollama LLM</span>
                <p className="mt-1 font-mono text-xs font-bold text-amber-300">
                  {etapas?.llmMs ? `${etapas.llmMs} ms` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5 text-center">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Guardrails</span>
                <p className="mt-1 font-mono text-xs font-bold text-emerald-400">
                  {metricas?.validadorOk !== false ? "100% OK" : "Revisar"}
                </p>
              </div>
            </div>

            {/* Transcripción completa en tiempo real */}
            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Transcripción en Vivo ({mensajes.length} turnos)
              </span>
              <div className="mt-3 flex flex-col gap-3">
                {mensajes.length === 0 ? (
                  <p className="text-xs text-slate-600 italic">
                    La conversación aparecerá aquí a medida que se desarrolle la llamada...
                  </p>
                ) : (
                  mensajes.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col gap-1 rounded-xl p-3 text-xs leading-relaxed ${
                        m.rol === "agente"
                          ? "border border-amber-500/20 bg-amber-500/5 text-amber-200"
                          : "border border-slate-800 bg-slate-900 text-slate-300"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {m.rol === "agente" ? "Bancoagrícola (AI)" : nombreCliente}
                      </span>
                      <p>{m.texto}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer con info del modelo */}
            <div className="mt-4 border-t border-slate-800 pt-3 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Modelo: llama3.1 (Ollama GPU)</span>
              <span>Canal: voz (pipeline)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
