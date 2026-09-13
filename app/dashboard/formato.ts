import { ESCALERA } from "@/lib/agent/ladder";
import type { BandaRiesgo, EstadoConversacion, MotivoContacto } from "@/lib/agent/types";
import type { Tasa } from "@/lib/dashboard/types";

/**
 * Formato y etiquetas de presentación. No calcula métricas: solo convierte a texto lo
 * que ya viene calculado en el contrato.
 */

export const SIN_DATO = "—";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** Los costos por turno son fracciones de centavo: con 2 decimales se verían como $0.00. */
const USD_FINO = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});
const ENTERO = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const FECHA = new Intl.DateTimeFormat("es-SV", {
  timeZone: "America/El_Salvador",
  dateStyle: "medium",
  timeStyle: "short",
});

export function usd(valor: number | null): string {
  if (valor === null) return SIN_DATO;
  return valor !== 0 && Math.abs(valor) < 0.01 ? USD_FINO.format(valor) : USD.format(valor);
}

export function entero(valor: number | null): string {
  return valor === null ? SIN_DATO : ENTERO.format(valor);
}

export function porcentaje(t: Tasa): string {
  return t.valor === null ? SIN_DATO : `${(t.valor * 100).toFixed(1)} %`;
}

export function fraccion(t: Tasa): string {
  return `${t.numerador} de ${t.denominador}`;
}

export function ms(valor: number | null): string {
  return valor === null ? SIN_DATO : `${ENTERO.format(valor)} ms`;
}

export function duracion(segundos: number | null): string {
  if (segundos === null) return SIN_DATO;
  const total = Math.round(segundos);
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)} min ${total % 60} s`;
}

export function fecha(iso: string | null): string {
  if (iso === null) return SIN_DATO;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? FECHA.format(t) : iso;
}

export const ETIQUETA_ESTADO: Record<EstadoConversacion, string> = {
  abierta: "Abierta",
  cerrada_con_acuerdo: "Cerrada con acuerdo",
  cerrada_sin_acuerdo: "Cerrada sin acuerdo",
  escalada_humano: "Escalada a asesor humano",
};

export const ORDEN_BANDAS: ReadonlyArray<BandaRiesgo | "SIN_BANDA"> = [
  "LOW",
  "MODERATE",
  "MODERATE_HIGH",
  "CRITICAL",
  "SIN_BANDA",
];

export const ETIQUETA_BANDA: Record<BandaRiesgo | "SIN_BANDA", string> = {
  LOW: "Bajo",
  MODERATE: "Moderado",
  MODERATE_HIGH: "Moderado-alto",
  CRITICAL: "Crítico",
  SIN_BANDA: "Sin puntaje",
};

export const ETIQUETA_MOTIVO_CONTACTO: Record<MotivoContacto, string> = {
  atraso: "Tiene días de atraso",
  desalineacion_quincena: "La cuota vence antes de la quincena",
  desalineacion_remesa: "La cuota vence antes de la remesa",
  riesgo_alto: "Riesgo alto, sin atraso",
};

const ETIQUETA_MOTIVO_VALIDADOR = new Map<string, string>([
  ["palabra_prohibida", "Palabra prohibida"],
  ["otro_banco", "Mencionó otro banco"],
  ["demasiadas_frases", "Más de 3 frases"],
  ["demasiadas_exclamaciones", "Exceso de exclamaciones"],
  ["monto_inventado", "Monto que no sale del contexto"],
  ["falta_presentacion", "No se presentó"],
  ["escalon_invalido", "Opción fuera de la escalera"],
  ["truncada", "Respuesta cortada"],
  ["vacia", "Respuesta vacía"],
]);

export function etiquetaValidador(motivo: string): string {
  return ETIQUETA_MOTIVO_VALIDADOR.get(motivo) ?? motivo;
}

export function etiquetaEscalon(tipo: string): string {
  return ESCALERA.find((e) => e.id === tipo)?.titulo ?? tipo;
}
