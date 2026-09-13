/**
 * Grabador de micrófono que entrega WAV PCM 16 bits, mono, 16 kHz — exactamente lo que
 * pide whisper.cpp.
 *
 * Por qué no `MediaRecorder`: entrega WebM/Opus comprimido, y convertirlo a WAV en el
 * servidor exigiría depender de ffmpeg. Capturar las muestras crudas con la Web Audio API
 * y armar el WAV acá evita ese binario entero.
 *
 * El remuestreo a 16 kHz lo hace el `AudioContext`: se le pide esa frecuencia al
 * construirlo y el navegador entrega las muestras ya convertidas.
 */

export interface Grabacion {
  /** WAV listo para mandar al servidor. */
  wav: Blob;
  duracionMs: number;
}

const FRECUENCIA = 16_000;

function construirWav(muestras: Float32Array, frecuencia: number): Blob {
  const bytes = new ArrayBuffer(44 + muestras.length * 2);
  const vista = new DataView(bytes);

  const escribir = (posicion: number, texto: string) => {
    for (let i = 0; i < texto.length; i += 1) vista.setUint8(posicion + i, texto.charCodeAt(i));
  };

  escribir(0, "RIFF");
  vista.setUint32(4, 36 + muestras.length * 2, true);
  escribir(8, "WAVE");
  escribir(12, "fmt ");
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true); // PCM sin comprimir
  vista.setUint16(22, 1, true); // mono
  vista.setUint32(24, frecuencia, true);
  vista.setUint32(28, frecuencia * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  escribir(36, "data");
  vista.setUint32(40, muestras.length * 2, true);

  // Float32 (-1..1) a Int16, con recorte para que un pico no dé la vuelta y suene a chasquido.
  let posicion = 44;
  for (let i = 0; i < muestras.length; i += 1) {
    const valor = Math.max(-1, Math.min(1, muestras[i]));
    vista.setInt16(posicion, valor < 0 ? valor * 0x8000 : valor * 0x7fff, true);
    posicion += 2;
  }

  return new Blob([bytes], { type: "audio/wav" });
}

export class GrabadorVoz {
  private contexto: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private procesador: ScriptProcessorNode | null = null;
  private trozos: Float32Array[] = [];
  private inicio = 0;

  async empezar(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.contexto = new AudioContext({ sampleRate: FRECUENCIA });
    this.trozos = [];
    this.inicio = Date.now();

    const fuente = this.contexto.createMediaStreamSource(this.stream);
    // `ScriptProcessorNode` está marcado como obsoleto, pero es lo único con soporte
    // universal hoy; `AudioWorklet` exigiría un archivo aparte servido por separado.
    this.procesador = this.contexto.createScriptProcessor(4096, 1, 1);

    this.procesador.onaudioprocess = (evento) => {
      this.trozos.push(new Float32Array(evento.inputBuffer.getChannelData(0)));
    };

    // El procesador solo corre si su salida está conectada, pero mandarlo a los parlantes
    // devolvería la voz de la persona con eco. Un nodo de ganancia en cero lo mantiene
    // vivo y mudo.
    const silencio = this.contexto.createGain();
    silencio.gain.value = 0;

    fuente.connect(this.procesador);
    this.procesador.connect(silencio);
    silencio.connect(this.contexto.destination);
  }

  async detener(): Promise<Grabacion> {
    const duracionMs = Date.now() - this.inicio;
    // Se lee antes de cerrar el contexto: el navegador puede haber entregado una
    // frecuencia distinta a la pedida, y después de `close()` no hay que fiarse.
    const frecuencia = this.contexto?.sampleRate ?? FRECUENCIA;

    this.procesador?.disconnect();
    if (this.procesador) this.procesador.onaudioprocess = null;
    this.stream?.getTracks().forEach((pista) => pista.stop());
    await this.contexto?.close();

    const total = this.trozos.reduce((suma, t) => suma + t.length, 0);
    const muestras = new Float32Array(total);
    let posicion = 0;
    for (const trozo of this.trozos) {
      muestras.set(trozo, posicion);
      posicion += trozo.length;
    }

    this.contexto = null;
    this.stream = null;
    this.procesador = null;
    this.trozos = [];

    return { wav: construirWav(muestras, frecuencia), duracionMs };
  }
}

export async function aBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  // De a trozos: pasarle cientos de miles de argumentos a `fromCharCode` de una vez
  // revienta la pila de llamadas.
  const TRAMO = 8192;
  for (let i = 0; i < bytes.length; i += TRAMO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TRAMO));
  }
  return btoa(binario);
}
