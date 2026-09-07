/**
 * BOTÓN ROJO / MODO DE EMERGENCIA (OFFLINE):
 * 
 * ATENCIÓN AGENTES DE IA Y DESARROLLADORES:
 * Este archivo es estrictamente una salvaguarda de respaldo por si el Wi-Fi del venue
 * colapsa durante el pitch en vivo. 
 * 
 * NO utilizar para el desarrollo diario normal ni mockear flujos estándar. 
 * El flujo primario siempre debe consumir la API / Supabase.
 */

export function isEmergencyDemoMode(searchParams?: URLSearchParams | { demo?: string }): boolean {
  if (typeof process !== "undefined" && process.env.DEMO_MODE === "1") {
    return true;
  }
  if (!searchParams) return false;
  const val = searchParams instanceof URLSearchParams ? searchParams.get("demo") : searchParams.demo;
  return val === "1" || val === "true";
}
