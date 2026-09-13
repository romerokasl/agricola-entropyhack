/**
 * Vuelca el dataset de juguete a `supabase/seed.sql`.
 *
 * Los datos viven en `dataset.mjs`; acá solo se emite el SQL. Es determinista: misma
 * semilla, mismo archivo byte a byte. Eso permite commitear el `seed.sql` resultante y
 * que cualquiera lo aplique pegándolo en el SQL Editor de Supabase.
 *
 * Si no tenés psql ni querés pegar SQL a mano, usá `npm run seed:apply`, que siembra
 * lo mismo por el cliente de Supabase.
 *
 * Uso:  npm run seed:generate
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { COLUMNAS, PERSONAJES, SEED, SYNTHETIC_COUNT, construirClientes, contarPorBanda } from "./dataset.mjs";

const sqlLiteral = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const fila = (c) => `  (${COLUMNAS.map((col) => sqlLiteral(c[col])).join(", ")})`;

const todos = construirClientes();
const bandas = contarPorBanda(todos);
const resumenBandas = Object.entries(bandas).sort().map(([k, v]) => `${k}=${v}`).join(" · ");

const sql = `-- GENERADO AUTOMÁTICAMENTE por scripts/generate-seed.mjs — no editar a mano.
-- Regenerar con:  node scripts/generate-seed.mjs
--
-- Semilla: ${SEED} (determinista: misma semilla, mismo archivo byte a byte)
-- Clientes: ${todos.length} (${PERSONAJES.length} personajes del pitch + ${SYNTHETIC_COUNT} sintéticos)
-- Distribución por banda de riesgo: ${resumenBandas}
--
-- Dataset de juguete, autorizado explícitamente por el banco en el Q&A del brief.
-- Qué controla qué está documentado en supabase/README.md.

truncate acuerdos, turnos, conversaciones, clientes cascade;

insert into clientes (${COLUMNAS.join(", ")}) values
${todos.map(fila).join(",\n")};
`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "..", "supabase", "seed.sql"), sql, "utf8");

console.log(`seed.sql escrito: ${todos.length} clientes`);
console.log(`  personajes: ${PERSONAJES.map((p) => p.slug).join(", ")}`);
console.log(`  bandas: ${resumenBandas}`);
