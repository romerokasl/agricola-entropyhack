export type TipoIngreso = "quincenal" | "mensual" | "irregular";

export type BandaRiesgo = "LOW" | "MODERATE" | "MODERATE_HIGH" | "CRITICAL";

export type Canal = "texto" | "voz";

export type ModoVoz = "pipeline" | "s2s";

export type Apertura = "agente" | "cliente";

export type RolTurno = "agente" | "cliente" | "sistema";

export type EstadoConversacion =
  | "abierta"
  | "cerrada_con_acuerdo"
  | "cerrada_sin_acuerdo"
  | "escalada_humano";

export type TipoCierre = "acuerdo" | "no_acuerdo";

export interface Cliente {
  id: string;
  slug: string;
  nombre: string;
  edad: number | null;
  distrito: string;
  segmento: string;
  tipoIngreso: TipoIngreso;
  diaIngreso1: number;
  diaIngreso2: number | null;
  diaRemesa: number | null;
  producto: string;
  cuota: number;
  saldo: number;
  diaPago: number;
  diasAtraso: number;
  tieneDebitoAutomatico: boolean;
  riesgoScore: number | null;
  riesgoBanda: BandaRiesgo | null;
}

/** Por qué el sistema decide abrir una conversación. `null` = no la abre. */
export type MotivoContacto =
  | "desalineacion_quincena"
  | "desalineacion_remesa"
  | "atraso"
  | "riesgo_alto";

export interface Diagnostico {
  motivo: MotivoContacto | null;
  /** Explicación en lenguaje llano, para que el agente la use al abrir. */
  detalle: string;
  diasHastaVencimiento: number;
  diasHastaReporteBuro: number;
  /** Siguiente día de cobro del cliente (15, 30, o su día de remesa). */
  proximoIngreso: number | null;
}

export interface Turno {
  rol: RolTurno;
  texto: string;
}

export interface MetricasTurno {
  /**
   * Round-trip completo del turno. Es el campo común con speech-to-speech: el dashboard
   * compara los dos enfoques por acá, sin casos especiales.
   */
  latenciaMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  validadorOk: boolean;
  validadorMotivo: string | null;
  modeloVersion: string;

  /**
   * Desglose por etapa del pipeline. Es el extra que solo la cascada puede dar: en S2S
   * la latencia es una caja negra de un solo número. Nulos en el canal de texto, que no
   * tiene etapas de audio.
   */
  latenciaSttMs?: number | null;
  latenciaLlmMs?: number | null;
  latenciaValidadorMs?: number | null;
  latenciaTtsMs?: number | null;
}
