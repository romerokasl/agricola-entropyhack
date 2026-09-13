/**
 * Resetea el estado del demo en un comando.
 *
 * Borra las conversaciones (y en cascada sus turnos y acuerdos). NO toca `clientes`:
 * los clientes se siembran una vez con supabase/seed.sql y no cambian entre corridas.
 *
 * Uso:  npm run demo:reset
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local (ver .env.example).",
  );
  process.exit(1);
}

const db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { count: antes } = await db
  .from("conversaciones")
  .select("*", { count: "exact", head: true });

// `neq` con un UUID imposible borra todas las filas: el cliente de Supabase exige
// siempre un filtro en delete, para no borrar una tabla por accidente.
const { error } = await db
  .from("conversaciones")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");

if (error) {
  console.error(`No se pudo resetear: ${error.message}`);
  process.exit(1);
}

console.log(`Demo reseteado: ${antes ?? 0} conversación(es) borrada(s).`);
console.log("Los clientes quedan intactos. Para re-sembrarlos: supabase/seed.sql");
