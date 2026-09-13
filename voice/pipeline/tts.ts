import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Etapa TTS del pipeline: texto validado y normalizado → audio.
 *
 * Misma forma que `lib/agent/llm.ts` a propósito — una interfaz, un `obtener*` que lee
 * una variable de entorno. Eso es lo que sostiene la frase del pitch "cambiar de
 * proveedor es cambiar un archivo", aplicada a las tres etapas y no solo al LLM.
 *
 * Primario hoy: **Piper local**. Sin cuenta, sin tarjeta y sin límite de caracteres —
 * el mismo criterio que llevó a Ollama para el LLM. Medido en la laptop de desarrollo:
 * factor de tiempo real 0.059, o sea 7.1 s de audio sintetizados en 0.42 s.
 *
 * `navegador` es el valor por defecto y no es un proveedor de servidor: significa que el
 * audio lo genera el cliente con `SpeechSynthesis`. Por eso `obtenerTtsProvider`
 * devuelve `null` ahí — la ruta omite el audio y el navegador se encarga.
 */

export interface ResultadoTts {
  /** WAV PCM 16 bits, mono. */
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
 * `null` significa "que hable el navegador" — no es un error ni un proveedor faltante.
 * Es el comportamiento por defecto y el que no necesita instalar nada.
 */
export function obtenerTtsProvider(): TtsProvider | null {
  const nombre = process.env.TTS_PROVIDER ?? "navegador";
  if (nombre === "navegador") return null;
  if (nombre === "piper") return crearPiperProvider();
  throw new Error(
    `TTS_PROVIDER="${nombre}" no está implementado. Valores válidos: "navegador" (SpeechSynthesis del cliente) y "piper" (local).`,
  );
}
