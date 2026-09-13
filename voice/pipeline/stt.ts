import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Etapa STT del pipeline: audio de la persona → texto.
 *
 * Misma forma que `tts.ts` y `lib/agent/llm.ts`: una interfaz, un `obtener*` que lee una
 * variable de entorno.
 *
 * Primario hoy: **whisper.cpp local**. Sin cuenta, sin tarjeta y sin límite, igual que
 * Piper para el TTS.
 *
 * `navegador` es el valor por defecto y no es un proveedor de servidor: significa que la
 * transcripción la hace el cliente con la Web Speech API y llega texto en vez de audio.
 * Por eso `obtenerSttProvider` devuelve `null` ahí.
 *
 * Diferencia que importa para el jurado: con `whisper`, la transcripción la produce el
 * servidor y queda como evidencia auditable. Con `navegador` la produce el cliente, que
 * es más débil como prueba técnica.
 */

export interface ResultadoStt {
  texto: string;
  latenciaMs: number;
}

export interface SttProvider {
  readonly nombre: string;
  /** Recibe WAV PCM 16 bits, mono, 16 kHz — lo que exige whisper.cpp. */
  transcribir(wav: Buffer): Promise<ResultadoStt>;
}

const DIR_BIN = join(process.cwd(), "voice", "pipeline", "bin");
const TIMEOUT_MS = 60_000;

/**
 * Sesga el vocabulario hacia el dominio. Medido: sin esto, el modelo `base` entiende
 * "Banco Alicola" en vez de "Bancoagrícola" y "fecha de paro" en vez de "fecha de pago".
 * No fuerza nada — solo hace más probables las palabras que de verdad van a aparecer.
 */
const VOCABULARIO =
  "Bancoagrícola, Karla, cuota, quincena, remesa, tarjeta, abono, fecha de pago, colón, pisto.";

function crearWhisperProvider(): SttProvider {
  const binario =
    process.env.WHISPER_BIN ?? join(DIR_BIN, "whisper", "Release", "whisper-cli.exe");
  const modelo = process.env.WHISPER_MODELO ?? join(DIR_BIN, "modelos", "ggml-base.bin");

  return {
    nombre: `whisper/${modelo.split(/[\\/]/).pop() ?? "modelo"}`,

    transcribir(wav: Buffer): Promise<ResultadoStt> {
      return new Promise((resolve, reject) => {
        const inicio = Date.now();
        // whisper-cli lee de un archivo, no de la entrada estándar. El temporal va al
        // directorio temporal del sistema y se borra pase lo que pase.
        const carpeta = mkdtempSync(join(tmpdir(), "voz-"));
        const ruta = join(carpeta, "turno.wav");
        writeFileSync(ruta, wav);

        const limpiar = () => rmSync(carpeta, { recursive: true, force: true });

        const proceso = spawn(
          binario,
          ["-m", modelo, "-f", ruta, "-l", "es", "-nt", "-np", "--prompt", VOCABULARIO],
          { stdio: ["ignore", "pipe", "pipe"] },
        );

        let salida = "";
        let errores = "";

        const temporizador = setTimeout(() => {
          proceso.kill();
          limpiar();
          reject(new Error(`Whisper no respondió en ${TIMEOUT_MS} ms.`));
        }, TIMEOUT_MS);

        proceso.stdout.on("data", (t: Buffer) => {
          salida += t.toString();
        });
        proceso.stderr.on("data", (t: Buffer) => {
          errores += t.toString();
        });

        proceso.on("error", (e) => {
          clearTimeout(temporizador);
          limpiar();
          reject(
            new Error(
              `No se pudo ejecutar Whisper en "${binario}". ¿Corriste "npm run voz:instalar"? (${e.message})`,
            ),
          );
        });

        proceso.on("close", (codigo) => {
          clearTimeout(temporizador);
          limpiar();
          if (codigo !== 0) {
            reject(new Error(`Whisper terminó con código ${codigo}: ${errores.slice(0, 300)}`));
            return;
          }
          resolve({ texto: salida.trim(), latenciaMs: Date.now() - inicio });
        });
      });
    },
  };
}

/**
 * `null` significa "que transcriba el navegador" — no es un error ni un proveedor
 * faltante. Es el comportamiento por defecto y el que no necesita instalar nada.
 */
export function obtenerSttProvider(): SttProvider | null {
  const nombre = process.env.STT_PROVIDER ?? "navegador";
  if (nombre === "navegador") return null;
  if (nombre === "whisper") return crearWhisperProvider();
  throw new Error(
    `STT_PROVIDER="${nombre}" no está implementado. Valores válidos: "navegador" (Web Speech del cliente) y "whisper" (local).`,
  );
}
