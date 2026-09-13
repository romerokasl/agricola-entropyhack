/**
 * Aplica las migraciones de supabase/migrations/ en orden.
 *
 * Existe porque el equipo trabaja en Windows y psql no viene instalado. Las
 * migraciones siguen siendo archivos SQL versionados — esto solo las ejecuta.
 *
 * Uso:  npm run db:migrate
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes("[password]")) {
  console.error("Falta DATABASE_URL en .env.local (Project Settings → Database → Connection string).");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const dirMigraciones = join(here, "..", "supabase", "migrations");

const archivos = readdirSync(dirMigraciones)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (archivos.length === 0) {
  console.error("No hay migraciones en supabase/migrations/.");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await cliente.connect();

try {
  for (const archivo of archivos) {
    const sql = readFileSync(join(dirMigraciones, archivo), "utf8");
    await cliente.query(sql);
    console.log(`  aplicada  ${archivo}`);
  }
  console.log(`\n${archivos.length} migración(es) aplicada(s).`);
} catch (e) {
  console.error(`\nFalló: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
