/**
 * Conversión de audio entre la Web Audio API (Float32, -1..1) y el formato de la
 * Realtime API (PCM 16 bits little-endian, mono, en base64).
 *
 * Funciones puras: se verifican sin navegador en `scripts/verificar-s2s.ts`.
 * `btoa`/`atob` existen en el navegador y en Node 20.
 */

/** Float32 a Int16, con recorte: un pico fuera de rango daría la vuelta y sonaría a chasquido. */
export function float32APcm16(muestras: ArrayLike<number>): Int16Array {
  const salida = new Int16Array(muestras.length);
  for (let i = 0; i < muestras.length; i += 1) {
    const v = Math.max(-1, Math.min(1, muestras[i]));
    salida[i] = v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff);
  }
  return salida;
}

export function pcm16AFloat32(pcm: Int16Array): Float32Array {
  const salida = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    salida[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff;
  }
  return salida;
}

/** Little-endian explícito con DataView, sin depender del orden de bytes de la máquina. */
export function pcm16ABase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.length * 2);
  const vista = new DataView(bytes.buffer);
  for (let i = 0; i < pcm.length; i += 1) vista.setInt16(i * 2, pcm[i], true);

  let binario = "";
  // De a tramos: pasarle cientos de miles de argumentos a `fromCharCode` revienta la pila.
  const TRAMO = 8192;
  for (let i = 0; i < bytes.length; i += TRAMO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TRAMO));
  }
  return btoa(binario);
}

export function base64APcm16(base64: string): Int16Array {
  const binario = atob(base64);
  const muestras = new Int16Array(Math.floor(binario.length / 2));
  for (let i = 0; i < muestras.length; i += 1) {
    const bajo = binario.charCodeAt(i * 2);
    const alto = binario.charCodeAt(i * 2 + 1);
    const valor = (alto << 8) | bajo;
    muestras[i] = valor >= 0x8000 ? valor - 0x10000 : valor;
  }
  return muestras;
}

/**
 * Remuestreo lineal. El navegador casi siempre respeta el `sampleRate` pedido al
 * `AudioContext`, pero no está obligado: si entrega 48 kHz y se manda como 24 kHz, el
 * modelo escucha a la persona a media velocidad.
 */
export function remuestrear(muestras: Float32Array, desdeHz: number, haciaHz: number): Float32Array {
  if (desdeHz === haciaHz || muestras.length === 0) return muestras;
  const razon = desdeHz / haciaHz;
  const largo = Math.max(1, Math.round(muestras.length / razon));
  const salida = new Float32Array(largo);
  for (let i = 0; i < largo; i += 1) {
    const posicion = i * razon;
    const izquierda = Math.floor(posicion);
    const derecha = Math.min(izquierda + 1, muestras.length - 1);
    const fraccion = posicion - izquierda;
    salida[i] = muestras[izquierda] * (1 - fraccion) + muestras[derecha] * fraccion;
  }
  return salida;
}

export function concatenar(trozos: readonly Float32Array[]): Float32Array {
  const total = trozos.reduce((suma, t) => suma + t.length, 0);
  const salida = new Float32Array(total);
  let posicion = 0;
  for (const trozo of trozos) {
    salida.set(trozo, posicion);
    posicion += trozo.length;
  }
  return salida;
}
