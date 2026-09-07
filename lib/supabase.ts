import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "example-anon-key";

/**
 * Cliente público de Supabase para operaciones del navegador o datos públicos con RLS.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Cliente administrativo de Supabase con permisos completos para Route Handlers del servidor.
 * NUNCA debe ser importado en Client Components.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY no está configurada en las variables de entorno.");
  }
  return createClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
