import type { Apertura } from "../../../lib/agent/types";
import type { MotivoRechazo } from "../../../lib/agent/validator";
import { base64APcm16, concatenar, float32APcm16, pcm16ABase64, pcm16AFloat32, remuestrear } from "../audio";
import {
  acumular,
  AUDIO_MINIMO_MS,
  eventos,
  FRECUENCIA_AUDIO_HZ,
  interpretarEvento,
  respuestaVacia,
  sumarUso,
  textoDeRespuesta,
  URL_REALTIME,
  type EventoCliente,
  type RespuestaAcumulada,
  type UsoRespuesta,
} from "../protocolo";

/**
 * La llamada speech-to-speech en el navegador.
 *
 * ```
 * micrófono → WebSocket → gpt-realtime → audio RETENIDO
 *                                          │
 *                  transcripción del audio ┴→ /api/voz-s2s (validador) → ¿pasa?
 *                                                                  sí → suena
 *                                                                  no → se borra, reintento
 * ```
 *
 * Por qué WebSocket y no WebRTC, que es lo que OpenAI recomienda para navegadores: con
 * WebRTC el audio del modelo llega como una pista que el navegador reproduce apenas
 * llega, y no hay forma de retenerlo hasta que el validador lo apruebe. Con WebSocket el
 * audio llega como datos, y la compuerta es posible. Se paga en latencia: se pierde el
 * streaming de salida, que es la ventaja principal de S2S.
 */

export type EstadoLlamada =
  | "inactiva"
  | "conectando"
  | "lista"
  | "escuchando"
  | "pensando"
  | "hablando"
  | "cerrada"
  | "colgada"
  | "error";

export interface MetricasTurnoS2S {
  /** Desde que se soltó el botón hasta que la respuesta aceptada terminó de generarse. Es lo que se persiste. */
  idaYVueltaMs: number;
  /** Desde que se soltó el botón hasta que empezó a sonar. Incluye la compuerta del validador. */
  hastaQueSuenaMs: number;
  validadorMs: number;
  validadorOk: boolean;
  intentos: number;
}

export interface OyentesLlamada {
  estado(estado: EstadoLlamada): void;
  mensaje(rol: "agente" | "cliente", texto: string): void;
  aviso(texto: string): void;
  metricas(metricas: MetricasTurnoS2S): void;
}

interface RespuestaApi<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface DatosInicio {
  conversacionId: string;
  modelo: string;
  clientSecret: string;
  disparadorApertura: string | null;
}

interface DatosTool {
  salida: Record<string, unknown>;
  cerroConversacion: boolean;
}

type DatosTurno =
  | { accion: "reintentar"; motivo: MotivoRechazo; notaCorrectiva: string }
  | { accion: "reproducir" | "respuesta_segura"; texto: string; validadorOk: boolean; latenciaValidadorMs: number };

interface TurnoEnCurso {
  inicio: number;
  intento: 1 | 2;
  motivoPrevio: MotivoRechazo | null;
  uso: UsoRespuesta | null;
  vueltasTool: number;
  /** `true` si el turno lo abrió la persona hablando; `false` en el saludo del agente. */
  conPersona: boolean;
  textoCliente: Promise<string | null>;
}

/** Mismo techo que el orquestador de texto. */
const MAX_VUELTAS_TOOLS = 3;
const ESPERA_TRANSCRIPCION_MS = 8_000;
const SIN_TRANSCRIPCION = "[sin transcripción]";

async function llamarApi<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/voz-s2s", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  const json = (await res.json()) as RespuestaApi<T>;
  if (!json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }
  return json.data;
}

export class LlamadaRealtime {
  private ws: WebSocket | null = null;
  private conversacionId: string | null = null;
  private estadoActual: EstadoLlamada = "inactiva";
  private respuesta: RespuestaAcumulada = respuestaVacia();
  private turno: TurnoEnCurso | null = null;
  private cerrarAlTerminar = false;

  private microfono: MediaStream | null = null;
  private ctxCaptura: AudioContext | null = null;
  private procesador: ScriptProcessorNode | null = null;
  private capturando = false;
  private muestrasCapturadas = 0;

  private ctxSalida: AudioContext | null = null;
  private fuente: AudioBufferSourceNode | null = null;
  private sonando: { itemId: string | null; desde: number } | null = null;

  private resolverTranscripcion: ((texto: string | null) => void) | null = null;

  constructor(
    private readonly slug: string,
    private readonly apertura: Apertura,
    private readonly oyentes: OyentesLlamada,
  ) {}

  // --- Ciclo de vida ------------------------------------------------------------------

  /** Llamar desde un gesto del usuario: sin eso el navegador no deja sonar el saludo. */
  async conectar(): Promise<void> {
    if (this.estadoActual !== "inactiva") return;
    this.cambiarEstado("conectando");

    this.ctxSalida = new AudioContext({ sampleRate: FRECUENCIA_AUDIO_HZ });
    void this.ctxSalida.resume();

    let inicio: DatosInicio;
    try {
      inicio = await llamarApi<DatosInicio>({ accion: "iniciar", slug: this.slug, apertura: this.apertura });
    } catch (e) {
      this.fallar(e instanceof Error ? e.message : "No se pudo iniciar la llamada.");
      return;
    }
    this.conversacionId = inicio.conversacionId;

    const ws = new WebSocket(`${URL_REALTIME}?model=${encodeURIComponent(inicio.modelo)}`, [
      "realtime",
      `openai-insecure-api-key.${inicio.clientSecret}`,
    ]);
    this.ws = ws;

    ws.onmessage = (mensaje) => {
      if (typeof mensaje.data === "string") this.alRecibir(mensaje.data);
    };
    ws.onerror = () => this.fallar("Se cortó la conexión con el servicio de voz.");
    ws.onclose = () => this.fallar("La llamada se desconectó.");
    ws.onopen = () => {
      if (inicio.disparadorApertura !== null) {
        this.enviar(eventos.mensajeUsuario(inicio.disparadorApertura));
        this.empezarTurno(false, Promise.resolve(null));
      } else {
        this.cambiarEstado("lista");
      }
    };
  }

  colgar(): void {
    this.liberar();
    this.cambiarEstado("colgada");
  }

  /**
   * Al desmontar la pantalla. Libera todo sin avisarle a una UI que ya no existe: en
   * desarrollo React monta los efectos dos veces, y avisar "colgada" dejaba la pantalla
   * nueva en llamada terminada antes de empezar.
   */
  destruir(): void {
    this.liberar();
    this.estadoActual = "colgada";
  }

  // --- Push-to-talk ---------------------------------------------------------------------

  async empezarAHablar(): Promise<void> {
    if (this.ws === null || this.capturando) return;
    if (this.estadoActual === "hablando") {
      this.interrumpir();
    } else if (this.estadoActual !== "lista") {
      return;
    }

    try {
      await this.prepararMicrofono();
    } catch {
      this.oyentes.aviso("Necesito permiso del micrófono para escucharte.");
      this.cambiarEstado("lista");
      return;
    }

    this.enviar(eventos.limpiarAudio());
    this.muestrasCapturadas = 0;
    this.capturando = true;
    this.cambiarEstado("escuchando");
  }

  dejarDeHablar(): void {
    if (!this.capturando) return;
    this.capturando = false;

    const duracionMs = (this.muestrasCapturadas / FRECUENCIA_AUDIO_HZ) * 1000;
    if (duracionMs < AUDIO_MINIMO_MS) {
      this.enviar(eventos.limpiarAudio());
      this.cambiarEstado("lista");
      return;
    }

    this.enviar(eventos.confirmarAudio());
    const textoCliente = new Promise<string | null>((resolve) => {
      const temporizador = setTimeout(() => {
        this.resolverTranscripcion = null;
        resolve(null);
      }, ESPERA_TRANSCRIPCION_MS);
      this.resolverTranscripcion = (texto) => {
        clearTimeout(temporizador);
        this.resolverTranscripcion = null;
        resolve(texto);
      };
    });
    this.empezarTurno(true, textoCliente);
  }

  // --- Eventos del modelo -----------------------------------------------------------------

  private alRecibir(crudo: string): void {
    const evento = interpretarEvento(crudo);

    switch (evento.type) {
      case "error":
        // Cancelar cuando no había respuesta activa es inofensivo: pasa en cada interrupción.
        if (evento.codigo === "response_cancel_not_active") return;
        console.error(`[s2s] ${evento.codigo ?? "error"}: ${evento.mensaje}`);
        this.oyentes.aviso("El servicio de voz tuvo un problema. Probá de nuevo.");
        return;

      case "conversation.item.input_audio_transcription.completed": {
        const texto = evento.transcripcion.trim();
        if (texto.length > 0) this.oyentes.mensaje("cliente", texto);
        this.resolverTranscripcion?.(texto.length > 0 ? texto : null);
        return;
      }

      case "conversation.item.input_audio_transcription.failed":
        this.resolverTranscripcion?.(null);
        return;

      case "response.done":
        acumular(this.respuesta, evento);
        void this.alTerminarRespuesta();
        return;

      default:
        acumular(this.respuesta, evento);
    }
  }

  private empezarTurno(conPersona: boolean, textoCliente: Promise<string | null>): void {
    this.turno = {
      inicio: Date.now(),
      intento: 1,
      motivoPrevio: null,
      uso: null,
      vueltasTool: 0,
      conPersona,
      textoCliente,
    };
    this.cambiarEstado("pensando");
    this.pedirRespuesta();
  }

  private pedirRespuesta(sinHerramientas = false): void {
    this.respuesta = respuestaVacia();
    this.enviar(eventos.pedirRespuesta(sinHerramientas));
  }

  private async alTerminarRespuesta(): Promise<void> {
    const turno = this.turno;
    const respuesta = this.respuesta;
    if (turno === null) return;

    // Se cuentan TODAS las respuestas del turno: las que llamaron herramientas y las que
    // rechazó el validador también se pagan.
    turno.uso = sumarUso(turno.uso, respuesta.uso);

    // Una interrupción cancela la respuesta; el turno ya se descartó al interrumpir.
    if (respuesta.estado === "cancelada") return;

    if (respuesta.estado === "fallida") {
      this.turno = null;
      this.oyentes.aviso("El servicio de voz no pudo responder. Probá de nuevo.");
      this.cambiarEstado("lista");
      return;
    }

    if (respuesta.llamadas.length > 0) {
      // Lo que el modelo haya dicho junto a la llamada no sonó: se saca de su contexto
      // para que coincida con lo que la persona escuchó.
      this.borrarItems(respuesta.itemsMensaje);
      await this.resolverHerramientas(turno, respuesta);
      return;
    }

    await this.pasarPorCompuerta(turno, respuesta);
  }

  private async resolverHerramientas(turno: TurnoEnCurso, respuesta: RespuestaAcumulada): Promise<void> {
    turno.vueltasTool += 1;

    for (const llamada of respuesta.llamadas) {
      let salida: Record<string, unknown>;
      try {
        const datos = await llamarApi<DatosTool>({
          accion: "tool",
          conversacionId: this.conversacionId,
          nombre: llamada.nombre,
          argumentos: llamada.argumentos,
        });
        salida = datos.salida;
        if (datos.cerroConversacion) this.cerrarAlTerminar = true;
      } catch {
        salida = {
          error: "No se pudo ejecutar la herramienta.",
          instruccion: "Esto es un problema interno. NO se lo menciones a la persona.",
        };
      }
      this.enviar(eventos.resultadoTool(llamada.callId, salida));
    }

    this.pedirRespuesta(turno.vueltasTool >= MAX_VUELTAS_TOOLS);
  }

  /** El corazón de este enfoque: nada suena sin que el servidor lo haya validado. */
  private async pasarPorCompuerta(turno: TurnoEnCurso, respuesta: RespuestaAcumulada): Promise<void> {
    const textoCliente = await turno.textoCliente;
    const latenciaMs = Date.now() - turno.inicio;

    let datos: DatosTurno;
    try {
      datos = await llamarApi<DatosTurno>({
        accion: "turno",
        conversacionId: this.conversacionId,
        textoCliente: turno.conPersona ? (textoCliente ?? SIN_TRANSCRIPCION) : null,
        textoAgente: textoDeRespuesta(respuesta),
        completa: respuesta.estado === "completada",
        intento: turno.intento,
        motivoPrevio: turno.motivoPrevio,
        metricas: {
          latenciaMs,
          tokensIn: turno.uso?.tokensIn ?? null,
          tokensOut: turno.uso?.tokensOut ?? null,
        },
      });
    } catch (e) {
      // Sin validación no suena: se descarta aunque el audio estuviera bien.
      this.borrarItems(respuesta.itemsMensaje);
      this.turno = null;
      this.oyentes.aviso(e instanceof Error ? e.message : "No se pudo validar la respuesta.");
      this.cambiarEstado("lista");
      return;
    }

    if (datos.accion === "reintentar") {
      this.borrarItems(respuesta.itemsMensaje);
      this.enviar(eventos.mensajeSistema(`## CORRECCIÓN\n${datos.notaCorrectiva}`));
      turno.intento = 2;
      turno.motivoPrevio = datos.motivo;
      this.pedirRespuesta();
      return;
    }

    this.turno = null;
    this.oyentes.mensaje("agente", datos.texto);
    this.oyentes.metricas({
      idaYVueltaMs: latenciaMs,
      hastaQueSuenaMs: Date.now() - turno.inicio,
      validadorMs: datos.latenciaValidadorMs,
      validadorOk: datos.validadorOk,
      intentos: turno.intento,
    });

    if (datos.accion === "respuesta_segura") {
      // El audio del modelo no pasó dos veces: se descarta y se dice el texto seguro, que
      // es fijo y no necesita validarse. El modelo tiene que saber qué se dijo en su lugar.
      this.borrarItems(respuesta.itemsMensaje);
      this.enviar(eventos.mensajeAgente(datos.texto));
      await this.decirConNavegador(datos.texto);
    } else {
      await this.reproducir(respuesta);
    }

    this.despuesDeHablar();
  }

  // --- Audio de salida ------------------------------------------------------------------

  private reproducir(respuesta: RespuestaAcumulada): Promise<void> {
    const ctx = this.ctxSalida;
    if (ctx === null || respuesta.audio.length === 0) return Promise.resolve();

    const muestras = concatenar(respuesta.audio.map((trozo) => pcm16AFloat32(base64APcm16(trozo))));
    const buffer = ctx.createBuffer(1, muestras.length, FRECUENCIA_AUDIO_HZ);
    buffer.getChannelData(0).set(muestras);

    return new Promise((resolve) => {
      const fuente = ctx.createBufferSource();
      fuente.buffer = buffer;
      fuente.connect(ctx.destination);
      fuente.onended = () => {
        if (this.fuente === fuente) {
          this.fuente = null;
          this.sonando = null;
        }
        resolve();
      };
      this.fuente = fuente;
      this.sonando = { itemId: respuesta.itemsMensaje[0] ?? null, desde: ctx.currentTime };
      this.cambiarEstado("hablando");
      fuente.start();
    });
  }

  private decirConNavegador(texto: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      const enunciado = new SpeechSynthesisUtterance(texto);
      const voces = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("es"));
      const mejorVoz = voces.sort((a, b) => {
        const score = (v: SpeechSynthesisVoice) => {
          const n = v.name.toLowerCase();
          let p = 0;
          if (n.includes("natural") || n.includes("online") || n.includes("neural")) p += 100;
          if (n.includes("google")) p += 80;
          if (n.includes("lorena") || n.includes("dalia") || n.includes("salome")) p += 50;
          if (n.includes("desktop") || n.includes("sapi")) p -= 100;
          return p;
        };
        return score(b) - score(a);
      })[0];

      if (mejorVoz) enunciado.voice = mejorVoz;
      enunciado.lang = mejorVoz?.lang ?? "es-SV";
      enunciado.rate = 0.98;
      enunciado.pitch = 1.02;

      enunciado.onend = () => resolve();
      enunciado.onerror = () => resolve();
      this.cambiarEstado("hablando");
      window.speechSynthesis.speak(enunciado);
    });
  }

  /** La persona toma la palabra mientras el agente habla. */
  private interrumpir(): void {
    const ctx = this.ctxSalida;
    if (this.sonando?.itemId && ctx !== null) {
      this.enviar(eventos.truncarItem(this.sonando.itemId, (ctx.currentTime - this.sonando.desde) * 1000));
    }
    this.sonando = null;
    const fuente = this.fuente;
    this.fuente = null;
    fuente?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }

  private despuesDeHablar(): void {
    if (this.cerrarAlTerminar) {
      this.liberar();
      this.cambiarEstado("cerrada");
      return;
    }
    // Si la persona interrumpió, ya está en "escuchando": no se le pisa el estado.
    if (this.estadoActual === "hablando") this.cambiarEstado("lista");
  }

  // --- Micrófono ------------------------------------------------------------------------

  private async prepararMicrofono(): Promise<void> {
    if (this.ctxCaptura !== null) return;

    this.microfono = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    const ctx = new AudioContext({ sampleRate: FRECUENCIA_AUDIO_HZ });
    this.ctxCaptura = ctx;

    const entrada = ctx.createMediaStreamSource(this.microfono);
    // Obsoleto pero universal; es el mismo nodo que usa el grabador del pipeline.
    const procesador = ctx.createScriptProcessor(4096, 1, 1);
    procesador.onaudioprocess = (evento) => {
      if (!this.capturando) return;
      const muestras = remuestrear(evento.inputBuffer.getChannelData(0), ctx.sampleRate, FRECUENCIA_AUDIO_HZ);
      this.muestrasCapturadas += muestras.length;
      this.enviar(eventos.agregarAudio(pcm16ABase64(float32APcm16(muestras))));
    };

    // El procesador solo corre con la salida conectada; en ganancia cero no hay eco.
    const silencio = ctx.createGain();
    silencio.gain.value = 0;
    entrada.connect(procesador);
    procesador.connect(silencio);
    silencio.connect(ctx.destination);
    this.procesador = procesador;
  }

  // --- Utilidades -----------------------------------------------------------------------

  private borrarItems(itemIds: readonly string[]): void {
    for (const id of itemIds) this.enviar(eventos.borrarItem(id));
  }

  private enviar(evento: EventoCliente): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(evento));
  }

  private cambiarEstado(estado: EstadoLlamada): void {
    this.estadoActual = estado;
    this.oyentes.estado(estado);
  }

  private fallar(mensaje: string): void {
    const terminal: readonly EstadoLlamada[] = ["cerrada", "colgada", "error"];
    if (terminal.includes(this.estadoActual)) return;
    this.oyentes.aviso(mensaje);
    this.liberar();
    this.cambiarEstado("error");
  }

  private liberar(): void {
    this.capturando = false;
    this.resolverTranscripcion?.(null);

    if (this.ws !== null) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    const fuente = this.fuente;
    this.fuente = null;
    this.sonando = null;
    fuente?.stop();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();

    if (this.procesador !== null) this.procesador.onaudioprocess = null;
    this.procesador?.disconnect();
    this.microfono?.getTracks().forEach((pista) => pista.stop());
    void this.ctxCaptura?.close();
    void this.ctxSalida?.close();
    this.procesador = null;
    this.microfono = null;
    this.ctxCaptura = null;
    this.ctxSalida = null;
  }
}
