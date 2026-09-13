/**
 * Aplica las migraciones de supabase/migrations/ que todavía no se hayan aplicado.
 *
 * Existe porque el equipo trabaja en Windows y psql no viene instalado. Las
 * migraciones siguen siendo archivos SQL versionados — esto solo las ejecuta.
 *
 * Por qué lleva tabla de control: la versión anterior reejecutaba TODOS los archivos en
 * cada corrida. Como el primero (`20260912150000_create_agent_schema.sql`) hace
 * `create table` sin `if not exists`, a partir de la segunda corrida fallaba ahí y
 * **nunca llegaba a las migraciones nuevas**. Eso ya costó un incidente real: la
 * migración de señal de riesgo quedó sin aplicar mientras el código ya escribía esas
 * columnas, así que toda conversación fallaba contra Supabase y el síntoma parecía
 * "Supabase no funciona" cuando era desfase de esquema.
 *
 * Uso:  npm run db:migrate
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const TABLA_CONTROL = "_migraciones";
/** No es idempotente: crea las tablas base. Nunca debe reejecutarse. */
const MIGRACION_BASE = "20260912150000_create_agent_schema.sql";

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
  await cliente.query(`
    create table if not exists ${TABLA_CONTROL} (
      nombre      text primary key,
      aplicada_en timestamptz not null default now()
    )
  `);

  const yaAplicadas = new Set(
    (await cliente.query(`select nombre from ${TABLA_CONTROL}`)).rows.map((r) => r.nombre),
  );

  // Adopción de una base que ya existía antes de que hubiera tabla de control: si no
  // hay ningún registro pero las tablas ya están, la migración base se da por aplicada.
  // Reejecutarla fallaría, y saltarla a ciegas en una base vacía dejaría todo sin crear.
  const adoptadas = new Set();

  if (yaAplicadas.size === 0) {
    const { rows } = await cliente.query("select to_regclass('public.clientes') as existe");
    if (rows[0].existe !== null) {
      await cliente.query(`insert into ${TABLA_CONTROL} (nombre) values ($1)`, [MIGRACION_BASE]);
      yaAplicadas.add(MIGRACION_BASE);
      adoptadas.add(MIGRACION_BASE);
      console.log(`  adoptada  ${MIGRACION_BASE}  (el esquema ya existía)`);
    }
  }

  let aplicadas = 0;

  for (const archivo of archivos) {
    if (yaAplicadas.has(archivo)) {
      if (!adoptadas.has(archivo)) console.log(`  ya estaba ${archivo}`);
      continue;
    }

    const sql = readFileSync(join(dirMigraciones, archivo), "utf8");

    // Una transacción por archivo: si falla a la mitad no queda medio aplicada ni
    // registrada como aplicada.
    await cliente.query("begin");
    try {
      await cliente.query(sql);
      await cliente.query(`insert into ${TABLA_CONTROL} (nombre) values ($1)`, [archivo]);
      await cliente.query("commit");
    } catch (e) {
      await cliente.query("rollback");
      throw new Error(`${archivo}: ${e instanceof Error ? e.message : String(e)}`);
    }

    console.log(`  aplicada  ${archivo}`);
    aplicadas += 1;
  }

  console.log(
    aplicadas === 0
      ? "\nNada que aplicar: la base ya está al día."
      : `\n${aplicadas} migración(es) aplicada(s).`,
  );
} catch (e) {
  console.error(`\nFalló: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
