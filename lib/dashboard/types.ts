import type { IdEscalon } from "../agent/ladder";
import type {
  Apertura,
  BandaRiesgo,
  Canal,
  Cliente,
  EstadoConversacion,
  MotivoContacto,
  RolTurno,
} from "../agent/types";

/**
 * Contrato del dashboard.
 *
 * Todo lo que la UI necesita mostrar está en `ResumenDashboard` y `DetalleConversacion`.
 * La UI no calcula nada: si una vista necesita un número nuevo, se agrega acá y se
 * calcula en `metricas.ts`, no en el componente. El detalle de cada campo (fuente,
 * unidad, casos borde) está en docs/dashboard-contrato.md.
 */

// --- Filas crudas, ya normalizadas (numeric de Postgres → number) ----------------

export interface ConversacionFila {
  id: string;
  clienteId: string;
  canal: Canal;
  apertura: Apertura;
  estado: EstadoConversacion;
  iniciadaEn: string;
  cerradaEn: string | null;
}

/** Turno sin el texto: es lo único que necesitan las métricas agregadas. */
export interface TurnoMetricasFila {
  conversacionId: string;
  indice: number;
  rol: RolTurno;
  creadoEn: string;
  latenciaMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  validadorOk: boolean | null;
  validadorMotivo: string | null;
  modeloVersion: string | null;
}

export interface TurnoDetalle extends TurnoMetricasFila {
  texto: string;
}

export interface AcuerdoFila {
  conversacionId: string;
  escalon: number | null;
  tipo: string | null;
  monto: number | null;
  fechaAcordada: string | null;
  motivoNoAcuerdo: string | null;
  creadoEn: string;
}

export interface DatosDashboard {
  clientes: readonly Cliente[];
  conversaciones: readonly ConversacionFila[];
  turnos: readonly TurnoMetricasFila[];
  acuerdos: readonly AcuerdoFila[];
}

// --- Piezas reutilizables del contrato -------------------------------------------

/** Una tasa siempre viaja con su n. `valor` va de 0 a 1, y es null si no hay denominador. */
export interface Tasa {
  numerador: number;
  denominador: number;
  valor: number | null;
}

/** Percentiles por nearest-rank. Todo null cuando n = 0. */
export interface Distribucion {
  n: number;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

export interface Conteo<T extends string = string> {
  clave: T;
  cantidad: number;
}

// --- Resumen ---------------------------------------------------------------------

export interface ResumenDashboard {
  generadoEn: string;
  gestion: MetricasGestion;
  cartera: MetricasCartera;
  tecnico: MetricasTecnicas;
  provisiones: ProvisionesEvitadas;
  auditoria: FilaAuditoria[];
}

export interface MetricasGestion {
  conversaciones: {
    total: number;
    porEstado: Record<EstadoConversacion, number>;
    porCanal: Record<Canal, number>;
  };
  /** cerrada_con_acuerdo ÷ cerradas (con acuerdo + sin acuerdo + escalada). Excluye abiertas. */
  cierreConAcuerdo: Tasa;
  /** escalada_humano ÷ cerradas. */
  escalamientoHumano: Tasa;
  /** Siempre los 8 escalones, en orden, aunque estén en 0. */
  acuerdosPorEscalon: Array<{ escalon: number; id: IdEscalon; titulo: string; cantidad: number }>;
  /** Cuotas de los clientes con al menos un acuerdo cerrado. Cada cliente cuenta una vez. */
  cuotasProtegidas: { montoUsd: number; clientes: number };
  /** Suma de acuerdos.monto de las conversaciones cerradas con acuerdo. */
  montoComprometido: { montoUsd: number; acuerdosConMonto: number; acuerdosSinMonto: number };
  motivosNoAcuerdo: Conteo[];
}

export interface MetricasCartera {
  totalClientes: number;
  porBanda: Record<BandaRiesgo | "SIN_BANDA", number>;
  /** Según diagnosticar() de lib/agent/calendario.ts, evaluado a la fecha de `generadoEn`. */
  requierenContacto: { total: number; porMotivo: Record<MotivoContacto, number> };
}

export interface MetricasTecnicas {
  /** latencia_ms de los turnos del agente (incluye herramientas y reintento del validador). */
  latenciaAgenteMs: Distribucion;
  /** cerrada_en − iniciada_en, solo conversaciones cerradas. */
  duracionConversacionSeg: Distribucion;
  tokens: {
    entrada: number;
    salida: number;
    turnosConTokens: number;
    turnosSinTokens: number;
    /** Promedio entre las conversaciones con al menos un turno del agente. */
    promedioPorConversacion: { entrada: number | null; salida: number | null };
  };
  costo: CostoEstimado;
  validador: {
    /** validador_ok = false ÷ turnos del agente con validador registrado. */
    intervencion: Tasa;
    motivos: Conteo[];
  };
  modelos: Conteo[];
}

export interface CostoEstimado {
  /** A precio de lista del tier pagado. El tier gratuito que usa el demo cuesta $0. */
  totalUsd: number;
  turnosCosteados: number;
  turnosSinPrecio: number;
  turnosSinTokens: number;
  modelosSinPrecio: string[];
  /** Entre las conversaciones con al menos un turno del agente. */
  porConversacionUsd: number | null;
  /** Costo total ÷ conversaciones cerradas con acuerdo. */
  porAcuerdoUsd: number | null;
  preciosVigentesAl: string;
  fuente: string;
}

export interface ProvisionesEvitadas {
  reservaEvitadaUsd: number;
  clientes: number;
  supuesto: string;
}

// --- Auditoría -------------------------------------------------------------------

export interface FilaAuditoria {
  conversacionId: string;
  idCorto: string;
  clienteEnmascarado: string;
  producto: string | null;
  cuota: number | null;
  canal: Canal;
  apertura: Apertura;
  estado: EstadoConversacion;
  acuerdo: { escalon: number; tipo: string; monto: number | null; fechaAcordada: string | null } | null;
  motivoNoAcuerdo: string | null;
  turnos: number;
  latenciaP95Ms: number | null;
  tokensEntrada: number;
  tokensSalida: number;
  intervencionesValidador: number;
  iniciadaEn: string;
  cerradaEn: string | null;
}

export interface DetalleConversacion {
  fila: FilaAuditoria;
  turnos: TurnoDetalle[];
  /** La fila de `acuerdos` tal cual quedó en la base, o null si todavía no se registró. */
  acuerdoRegistrado: AcuerdoFila | null;
}
