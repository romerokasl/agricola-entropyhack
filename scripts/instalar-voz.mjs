/**
 * Baja los motores de voz locales: Piper (TTS) y whisper.cpp (STT), con sus modelos.
 *
 * Existe porque los binarios y los modelos NO se versionan — pesan ~230 MB. Sin este
 * script, cada integrante tendría que reconstruir a mano una carpeta que el código
 * espera encontrar.
 *
 * Es idempotente: lo que ya está descargado no se vuelve a bajar.
 *
 * Uso:  npm run voz:instalar
 */

import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const DIR_BIN = join(here, "..", "voice", "pipeline", "bin");
const DIR_VOCES = join(DIR_BIN, "voces");
const DIR_MODELOS = join(DIR_BIN, "modelos");

const PIPER_ZIP =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";

// Voz mexicana: es la más cercana al español centroamericano entre las disponibles.
const VOZ = "es_MX-ald-medium";
const BASE_VOZ = "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium";

const WHISPER_ZIP =
  "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip";

/**
 * `base` y no `small`: multilingüe igual, pero ~3× más rápido. Con `small` la etapa STT
 * se come el presupuesto de latencia del turno. Si hiciera falta más precisión, bajar
 * ggml-small.bin del mismo repositorio y apuntar WHISPER_MODELO ahí.
 */
const MODELO_WHISPER = "ggml-base.bin";
const BASE_MODELO = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

if (process.platform !== "win32") {
  console.error(
    `Este script está hecho para Windows, que es donde trabaja el equipo.\n` +
      `En ${process.platform}, bajá el binario que corresponda desde\n` +
      `  https://github.com/rhasspy/piper/releases\n` +
      `y la voz desde\n  ${BASE_VOZ}/${VOZ}.onnx\ndejándolos en voice/pipeline/bin/.`,
  );
  process.exit(1);
}

async function bajar(url, destino) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${res.status} al bajar ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destino));
}

const mb = (ruta) => `${(statSync(ruta).size / 1024 / 1024).toFixed(1)} MB`;

mkdirSync(DIR_VOCES, { recursive: true });
mkdirSync(DIR_MODELOS, { recursive: true });

/** Baja un zip y lo descomprime, salvo que el centinela ya exista. */
async function instalarZip({ nombre, url, destino, centinela }) {
  if (existsSync(centinela)) {
    console.log(`  ya estaba  ${nombre}`);
    return;
  }

  const zip = join(DIR_BIN, `${nombre}.zip`);
  console.log(`  bajando    ${nombre}…`);
  await bajar(url, zip);

  // Git Bash trae GNU tar, que no abre ZIP. Expand-Archive de PowerShell sí, y está en
  // cualquier Windows.
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path "${zip}" -DestinationPath "${destino}" -Force`],
    { stdio: "inherit" },
  );
  rmSync(zip, { force: true });

  if (r.status !== 0 || !existsSync(centinela)) {
    console.error(`No se pudo descomprimir ${nombre}.zip.`);
    process.exit(1);
  }
  console.log(`  instalado  ${nombre}`);
}

async function bajarArchivo(nombre, url, destino) {
  if (existsSync(destino)) {
    console.log(`  ya estaba  ${nombre}`);
    return;
  }
  console.log(`  bajando    ${nombre}…`);
  await bajar(url, destino);
  console.log(`  instalado  ${nombre}  (${mb(destino)})`);
}

// --- TTS: Piper y su voz ----------------------------------------------------
await instalarZip({
  nombre: "piper",
  url: PIPER_ZIP,
  destino: DIR_BIN,
  centinela: join(DIR_BIN, "piper", "piper.exe"),
});

for (const archivo of [`${VOZ}.onnx`, `${VOZ}.onnx.json`]) {
  await bajarArchivo(archivo, `${BASE_VOZ}/${archivo}`, join(DIR_VOCES, archivo));
}

// --- STT: whisper.cpp y su modelo -------------------------------------------
await instalarZip({
  nombre: "whisper",
  url: WHISPER_ZIP,
  destino: join(DIR_BIN, "whisper"),
  centinela: join(DIR_BIN, "whisper", "Release", "whisper-cli.exe"),
});

await bajarArchivo(
  MODELO_WHISPER,
  `${BASE_MODELO}/${MODELO_WHISPER}`,
  join(DIR_MODELOS, MODELO_WHISPER),
);

console.log(
  "\nListo. Activalos en .env.local:\n" +
    "  TTS_PROVIDER=piper     (sin esta variable habla el navegador)\n" +
    "  STT_PROVIDER=whisper   (sin esta variable transcribe el navegador)",
);
