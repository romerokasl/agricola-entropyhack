/**
 * Baja el motor de voz local (Piper) y su voz en español.
 *
 * Existe porque los binarios y los modelos NO se versionan — pesan 80 MB y el
 * `.gitignore` ya excluye `*.onnx`. Sin este script, cada integrante tendría que
 * reconstruir a mano una carpeta que el código espera encontrar.
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

const PIPER_ZIP =
  "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip";

// Voz mexicana: es la más cercana al español centroamericano entre las disponibles.
const VOZ = "es_MX-ald-medium";
const BASE_VOZ = "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium";

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

// --- Piper ------------------------------------------------------------------
const piperExe = join(DIR_BIN, "piper", "piper.exe");

if (existsSync(piperExe)) {
  console.log("  ya estaba  piper");
} else {
  const zip = join(DIR_BIN, "piper.zip");
  console.log("  bajando    piper…");
  await bajar(PIPER_ZIP, zip);

  // Git Bash trae GNU tar, que no abre ZIP. Expand-Archive de PowerShell sí, y está en
  // cualquier Windows.
  const r = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Expand-Archive -Path "${zip}" -DestinationPath "${DIR_BIN}" -Force`],
    { stdio: "inherit" },
  );
  rmSync(zip, { force: true });

  if (r.status !== 0 || !existsSync(piperExe)) {
    console.error("No se pudo descomprimir piper.zip.");
    process.exit(1);
  }
  console.log("  instalado  piper");
}

// --- Voz --------------------------------------------------------------------
for (const archivo of [`${VOZ}.onnx`, `${VOZ}.onnx.json`]) {
  const destino = join(DIR_VOCES, archivo);
  if (existsSync(destino)) {
    console.log(`  ya estaba  ${archivo}`);
    continue;
  }
  console.log(`  bajando    ${archivo}…`);
  await bajar(`${BASE_VOZ}/${archivo}`, destino);
  console.log(`  instalado  ${archivo}  (${mb(destino)})`);
}

console.log(
  `\nListo. Activalo con TTS_PROVIDER=piper en .env.local ` +
    `(sin esa variable habla el navegador).`,
);
