/**
 * Siembra el dataset de juguete directo en Supabase, sin psql.
 *
 * Existe porque el equipo trabaja en Windows y psql no viene instalado. Aplica
 * exactamente el mismo dataset que `supabase/seed.sql` — los dos leen de dataset.mjs.
 *
 * Requiere que el esquema ya esté aplicado (supabase/migrations/).
 * Uso:  npm run seed:apply
 */

import { createClient } from "@supabase/supabase-js";

import { construirClientes, contarPorBanda } from "./dataset.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const clientes = construirClientes();

// Borrar clientes arrastra en cascada conversaciones, turnos y acuerdos.
const { error: errorBorrado } = await db
  .from("clientes")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");

if (errorBorrado) {
  console.error(`No se pudo limpiar la tabla: ${errorBorrado.message}`);
  console.error("¿Está aplicado el esquema? Ver supabase/migrations/.");
  process.exit(1);
}

const TAMANO_LOTE = 100;
for (let i = 0; i < clientes.length; i += TAMANO_LOTE) {
  const lote = clientes.slice(i, i + TAMANO_LOTE);
  const { error } = await db.from("clientes").insert(lote);
  if (error) {
    console.error(`Falló el lote ${i / TAMANO_LOTE + 1}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  insertados ${Math.min(i + TAMANO_LOTE, clientes.length)}/${clientes.length}`);
}

const bandas = contarPorBanda(clientes);
console.log(`\n${clientes.length} clientes sembrados.`);
console.log(`  bandas: ${Object.entries(bandas).sort().map(([k, v]) => `${k}=${v}`).join(" · ")}`);
