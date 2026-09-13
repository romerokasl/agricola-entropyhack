import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

/**
 * Etapa TTS del pipeline: texto validado y normalizado → audio.
 *
 * Misma forma que `lib/agent/llm.ts` a propósito — una interfaz, un `obtener*` que lee
 * una variable de entorno. Eso es lo que sostiene la frase del pitch "cambiar de
 * proveedor es cambiar un archivo", aplicada a las tres etapas y no solo al LLM.
 *
 * Proveedores:
 * 1. **Edge TTS Neuronal**: Síntesis de ultra-alta fidelidad basada en voces neuronales
 *    (por defecto: `es-SV-LorenaNeural` para acento salvadoreño natural, empático y cálido).
 * 2. **Piper local**: Motor local ONNX sin conexión a internet.
 * 3. **Navegador**: Síntesis directa en el cliente con Web Speech API.
 */

export interface ResultadoTts {
  /** WAV PCM 16 bits mono, o MP3 24kHz estéreo/mono. */
  audio: Buffer;
  mime: string;
  latenciaMs: number;
}

export interface TtsProvider {
  readonly nombre: string;
  sintetizar(texto: string): Promise<ResultadoTts>;
}

const DIR_BIN = join(process.cwd(), "voice", "pipeline", "bin");
const TIMEOUT_MS = 30_000;

/**
 * Piper escribe PCM crudo en la salida estándar (`--output-raw`), sin cabecera. Se le
 * arma la cabecera WAV acá en vez de pedirle que escriba un archivo: así no hay archivos
 * temporales que limpiar ni carreras entre turnos simultáneos.
 */
function cabeceraWav(bytesDeAudio: number, frecuencia: number): Buffer {
  const canales = 1;
  const bitsPorMuestra = 16;
  const bytesPorSegundo = (frecuencia * canales * bitsPorMuestra) / 8;
  const alineacion = (canales * bitsPorMuestra) / 8;

  const cabecera = Buffer.alloc(44);
  cabecera.write("RIFF", 0);
  cabecera.writeUInt32LE(36 + bytesDeAudio, 4);
  cabecera.write("WAVE", 8);
  cabecera.write("fmt ", 12);
  cabecera.writeUInt32LE(16, 16); // tamaño del bloque fmt
  cabecera.writeUInt16LE(1, 20); // 1 = PCM sin comprimir
  cabecera.writeUInt16LE(canales, 22);
  cabecera.writeUInt32LE(frecuencia, 24);
  cabecera.writeUInt32LE(bytesPorSegundo, 28);
  cabecera.writeUInt16LE(alineacion, 32);
  cabecera.writeUInt16LE(bitsPorMuestra, 34);
  cabecera.write("data", 36);
  cabecera.writeUInt32LE(bytesDeAudio, 40);
  return cabecera;
}

/** La frecuencia sale del descriptor de la voz, no de una constante que se desincronice. */
function frecuenciaDeLaVoz(rutaModelo: string): number {
  try {
    const crudo = readFileSync(`${rutaModelo}.json`, "utf8");
    const config = JSON.parse(crudo) as { audio?: { sample_rate?: number } };
    return config.audio?.sample_rate ?? 22050;
  } catch {
    return 22050;
  }
}

function crearPiperProvider(): TtsProvider {
  const binario = process.env.PIPER_BIN ?? join(DIR_BIN, "piper", "piper.exe");
  const modelo = process.env.PIPER_VOZ ?? join(DIR_BIN, "voces", "es_MX-ald-medium.onnx");
  const frecuencia = frecuenciaDeLaVoz(modelo);

  return {
    nombre: `piper/${modelo.split(/[\\/]/).pop() ?? "voz"}`,

    sintetizar(texto: string): Promise<ResultadoTts> {
      return new Promise((resolve, reject) => {
        const inicio = Date.now();
        const proceso = spawn(binario, ["--model", modelo, "--output-raw"], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        const trozos: Buffer[] = [];
        let errores = "";

        const temporizador = setTimeout(() => {
          proceso.kill();
          reject(new Error(`Piper no respondió en ${TIMEOUT_MS} ms.`));
        }, TIMEOUT_MS);

        proceso.stdout.on("data", (t: Buffer) => trozos.push(t));
        proceso.stderr.on("data", (t: Buffer) => {
          errores += t.toString();
        });

        proceso.on("error", (e) => {
          clearTimeout(temporizador);
          reject(
            new Error(
              `No se pudo ejecutar Piper en "${binario}". ¿Corriste "npm run voz:instalar"? (${e.message})`,
            ),
          );
        });

        proceso.on("close", (codigo) => {
          clearTimeout(temporizador);
          if (codigo !== 0) {
            reject(new Error(`Piper terminó con código ${codigo}: ${errores.slice(0, 300)}`));
            return;
          }
          const pcm = Buffer.concat(trozos);
          resolve({
            audio: Buffer.concat([cabeceraWav(pcm.length, frecuencia), pcm]),
            mime: "audio/wav",
            latenciaMs: Date.now() - inicio,
          });
        });

        proceso.stdin.write(texto);
        proceso.stdin.end();
      });
    },
  };
}

/**
 * Proveedor de voz neuronal de Microsoft Edge (Azure Speech Neural Voices).
 * Gratuito, sin credenciales, con voces altamente expresivas, cálidas y empáticas.
 * Por defecto usa `es-SV-RodrigoNeural` (Rodrigo - El Salvador, MASCULINA) para entonación salvadoreña auténtica.
 *
 * RATING DE VOCES MASCULINAS (mejor a peor para empatía/naturalidad):
 * 1. es-SV-RodrigoNeural ⭐⭐⭐⭐⭐ (Friendly + Positive, acento salvadoreño natural)
 * 2. es-MX-JorgeNeural ⭐⭐⭐⭐ (Friendly + Positive, acento mexicano)
 * 3. es-MX-LorenzoEsCLNeural ⭐⭐⭐⭐ (Friendly + Positive, variante regional)
 *
 * Otras opciones: `es-MX-DaliaNeural` (femenina), `es-SV-LorenaNeural` (femenina SV).
 */
function crearEdgeTtsProvider(): TtsProvider {
  const voz = process.env.TTS_VOZ ?? "es-SV-RodrigoNeural";

  return {
    nombre: `edge/${voz}`,

    async sintetizar(texto: string): Promise<ResultadoTts> {
      const inicio = Date.now();
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const { audioStream } = tts.toStream(texto);
      const trozos: Buffer[] = [];

      return new Promise<ResultadoTts>((resolve, reject) => {
        const temporizador = setTimeout(() => {
          reject(new Error(`Edge TTS no respondió en ${TIMEOUT_MS} ms.`));
        }, TIMEOUT_MS);

        audioStream.on("data", (chunk: Buffer) => trozos.push(chunk));

        audioStream.on("end", () => {
          clearTimeout(temporizador);
          resolve({
            audio: Buffer.concat(trozos),
            mime: "audio/mp3",
            latenciaMs: Date.now() - inicio,
          });
        });

        audioStream.on("error", (err: unknown) => {
          clearTimeout(temporizador);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
      });
    },
  };
}

/**
 * `null` significa "que hable el navegador" — no es un error ni un proveedor faltante.
 * Si se especifica "edge" o "neural", se genera audio neuronal ultranatural en el backend.
 */
export function obtenerTtsProvider(): TtsProvider | null {
  const nombre = process.env.TTS_PROVIDER ?? "edge";
  if (nombre === "navegador") return null;
  if (nombre === "edge" || nombre === "neural" || nombre === "msedge") return crearEdgeTtsProvider();
  if (nombre === "piper") return crearPiperProvider();
  throw new Error(
    `TTS_PROVIDER="${nombre}" no está implementado. Valores válidos: "edge" (Neuronal El Salvador/México), "piper" (local) y "navegador" (SpeechSynthesis del cliente).`,
  );
}
