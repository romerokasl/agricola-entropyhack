import { getSupabaseAdmin } from "../supabase";
import type { FactorRiesgo, SenalPersistida, SenalRiesgo } from "../riesgo/types";
import { conReintentos } from "./reintentos";
import type {
  Apertura,
  BandaRiesgo,
  MotivoContacto,
  Canal,
  EstadoConversacion,
  MetricasTurno,
  ModoVoz,
  RolTurno,
  Turno,
} from "../agent/types";

export interface Conversacion {
  id: string;
  clienteId: string;
  canal: Canal;
  modoVoz: ModoVoz | null;
  apertura: Apertura;
  estado: EstadoConversacion;
  /** La señal que abrió la conversación. `null` en filas anteriores a la migración. */
  senal: SenalPersistida | null;
  motivoContacto: MotivoContacto | null;
}

interface FilaConversacion {
  id: string;
  cliente_id: string;
  canal: string;
  modo_voz: string | null;
  apertura: string;
  estado: string;
  riesgo_score: number | null;
  riesgo_banda: string | null;
  riesgo_clase_ssf: string | null;
  riesgo_fuente: string | null;
  riesgo_componente_modelo_vivo: number | null;
  riesgo_componente_registro: number | null;
  riesgo_componente_reglas: number | null;
  escalon_sugerido: number | null;
  riesgo_factores: FactorRiesgo[] | null;
  motivo_contacto: string | null;
}

const COLUMNAS_CONVERSACION =
  "id, cliente_id, canal, modo_voz, apertura, estado, riesgo_score, riesgo_banda, " +
  "riesgo_clase_ssf, riesgo_fuente, riesgo_componente_modelo_vivo, riesgo_componente_registro, " +
  "riesgo_componente_reglas, escalon_sugerido, riesgo_factores, motivo_contacto";

interface FilaTurno {
  rol: string;
  texto: string;
}

function aSenal(fila: FilaConversacion): SenalPersistida | null {
  if (fila.riesgo_score === null || fila.riesgo_banda === null) return null;
  return {
    score: fila.riesgo_score,
    banda: fila.riesgo_banda as BandaRiesgo,
    claseSSF: (fila.riesgo_clase_ssf as SenalPersistida["claseSSF"]) ?? null,
    fuente: (fila.riesgo_fuente as SenalPersistida["fuente"]) ?? "reglas",
    componenteModeloVivo: fila.riesgo_componente_modelo_vivo,
    componenteRegistro: fila.riesgo_componente_registro,
    componenteReglas: fila.riesgo_componente_reglas ?? fila.riesgo_score,
    escalonSugerido: fila.escalon_sugerido ?? 1,
    factores: fila.riesgo_factores ?? [],
  };
}

function aConversacion(fila: FilaConversacion): Conversacion {
  return {
    id: fila.id,
    clienteId: fila.cliente_id,
    canal: fila.canal as Canal,
    modoVoz: fila.modo_voz as ModoVoz | null,
    apertura: fila.apertura as Apertura,
    estado: fila.estado as EstadoConversacion,
    senal: aSenal(fila),
    motivoContacto: (fila.motivo_contacto as MotivoContacto | null) ?? null,
  };
}

export function tieneSupabase(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("example.supabase.co"),
  );
}

export const memoriaConversaciones = new Map<string, Conversacion>();
export const memoriaTurnos = new Map<string, Array<{ id: string; rol: RolTurno; texto: string; metricas?: MetricasTurno }>>();
export const memoriaAcuerdos = new Map<string, unknown>();

export async function crearConversacion(params: {
  clienteId: string;
  canal: Canal;
  modoVoz: ModoVoz | null;
  apertura: Apertura;
  /**
   * La señal que justificó abrir. Se guarda con la conversación, no aparte: es la
   * respuesta a "¿por qué el sistema le habló a esta persona hoy?", que es justo lo
   * que el banco pide poder auditar.
   */
  senal?: SenalRiesgo | null;
  /** Por qué el sistema abrió. `null` cuando abrió la persona. */
  motivoContacto?: MotivoContacto | null;
}): Promise<Conversacion> {
  const { senal } = params;

  if (!tieneSupabase()) {
    const id = crypto.randomUUID();
    const conv: Conversacion = {
      id,
      clienteId: params.clienteId,
      canal: params.canal,
      modoVoz: params.modoVoz,
      apertura: params.apertura,
      estado: "abierta",
      senal: senal
        ? {
            score: senal.score,
            banda: senal.banda,
            claseSSF: senal.claseSSF,
            fuente: senal.fuente,
            componenteModeloVivo: senal.componenteModeloVivo,
            componenteRegistro: senal.componenteRegistro,
            componenteReglas: senal.componenteReglas,
            escalonSugerido: senal.escalonSugerido,
            factores: senal.factores,
          }
        : null,
      motivoContacto: params.motivoContacto ?? null,
    };
    memoriaConversaciones.set(id, conv);
    memoriaTurnos.set(id, []);
    return conv;
  }

  return conReintentos("No se pudo crear la conversación", async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("conversaciones")
      .insert({
        cliente_id: params.clienteId,
        canal: params.canal,
        modo_voz: params.modoVoz,
        apertura: params.apertura,
        riesgo_score: senal?.score ?? null,
        riesgo_banda: senal?.banda ?? null,
        riesgo_clase_ssf: senal?.claseSSF ?? null,
        riesgo_fuente: senal?.fuente ?? null,
        riesgo_componente_modelo_vivo: senal?.componenteModeloVivo ?? null,
        riesgo_componente_registro: senal?.componenteRegistro ?? null,
        riesgo_componente_reglas: senal?.componenteReglas ?? null,
        escalon_sugerido: senal?.escalonSugerido ?? null,
        riesgo_factores: senal ? senal.factores : null,
        motivo_contacto: params.motivoContacto ?? null,
      })
      .select(COLUMNAS_CONVERSACION)
      .single<FilaConversacion>();

    if (error || !data) throw new Error(error?.message ?? "sin datos");
    return aConversacion(data);
  });
}

export function obtenerConversacion(id: string): Promise<Conversacion | null> {
  if (!tieneSupabase()) {
    return Promise.resolve(memoriaConversaciones.get(id) ?? null);
  }

  return conReintentos(`No se pudo leer la conversación ${id}`, async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("conversaciones")
      .select(COLUMNAS_CONVERSACION)
      .eq("id", id)
      .maybeSingle<FilaConversacion>();

    if (error) throw new Error(error.message);
    return data ? aConversacion(data) : null;
  });
}

export function obtenerTurnos(conversacionId: string): Promise<Turno[]> {
  if (!tieneSupabase()) {
    const list = memoriaTurnos.get(conversacionId) ?? [];
    return Promise.resolve(list.map((t) => ({ rol: t.rol, texto: t.texto })));
  }

  return conReintentos("No se pudieron leer los turnos", async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("turnos")
      .select("rol, texto")
      .eq("conversacion_id", conversacionId)
      .order("indice", { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as FilaTurno[]).map((f) => ({
      rol: f.rol as RolTurno,
      texto: f.texto,
    }));
  });
}

/**
 * Guarda un turno con sus métricas. Es la transcripción que el banco pide como
 * evidencia técnica, y la fuente de las métricas del dashboard.
 *
 * El `indice` lo calcula quien llama a partir del historial que ya tiene en memoria.
 * Antes se consultaba el máximo a la base en cada turno: era un viaje de ida y vuelta
 * extra que además se caía con Gateway Timeout contra el pooler.
 */
export async function agregarTurno(params: {
  conversacionId: string;
  indice: number;
  rol: RolTurno;
  texto: string;
  metricas?: MetricasTurno;
}): Promise<string> {
  const { indice, metricas } = params;

  if (!tieneSupabase()) {
    const id = crypto.randomUUID();
    const list = memoriaTurnos.get(params.conversacionId) ?? [];
    list.push({ id, rol: params.rol, texto: params.texto, metricas: params.metricas });
    memoriaTurnos.set(params.conversacionId, list);
    return Promise.resolve(id);
  }

  return conReintentos("No se pudo guardar el turno", async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("turnos")
      .insert({
        conversacion_id: params.conversacionId,
        indice,
        rol: params.rol,
        texto: params.texto,
        latencia_ms: metricas?.latenciaMs ?? null,
        tokens_in: metricas?.tokensIn ?? null,
        tokens_out: metricas?.tokensOut ?? null,
        validador_ok: metricas?.validadorOk ?? null,
        validador_motivo: metricas?.validadorMotivo ?? null,
        modelo_version: metricas?.modeloVersion ?? null,
        latencia_stt_ms: metricas?.latenciaSttMs ?? null,
        latencia_llm_ms: metricas?.latenciaLlmMs ?? null,
        latencia_validador_ms: metricas?.latenciaValidadorMs ?? null,
        latencia_tts_ms: metricas?.latenciaTtsMs ?? null,
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) throw new Error(error?.message ?? "sin datos");
    return data.id;
  });
}

/**
 * La síntesis ocurre DESPUÉS de persistir el turno — el texto ya pasó el validador y ya
 * es transcripción — así que su latencia se completa aparte. Es la única etapa que no se
 * puede medir antes de guardar.
 *
 * No usa reintentos a propósito: es telemetría del dashboard, no parte del flujo. Si
 * falla, la conversación no se entera.
 */
export async function registrarLatenciaTts(turnoId: string, latenciaMs: number): Promise<void> {
  if (!tieneSupabase()) return;

  const { error } = await getSupabaseAdmin()
    .from("turnos")
    .update({ latencia_tts_ms: latenciaMs })
    .eq("id", turnoId);

  if (error) console.error(`[voz] no se pudo registrar la latencia de TTS: ${error.message}`);
}

export async function guardarAcuerdo(params: {
  conversacionId: string;
  escalon: number;
  tipo: string;
  monto: number | null;
  fechaAcordada: string;
}): Promise<void> {
  if (!tieneSupabase()) {
    memoriaAcuerdos.set(params.conversacionId, params);
    const estado: EstadoConversacion =
      params.tipo === "pase_humano" ? "escalada_humano" : "cerrada_con_acuerdo";
    await cerrarConversacion(params.conversacionId, estado);
    return;
  }

  await conReintentos("No se pudo registrar el acuerdo", async () => {
    const { error } = await getSupabaseAdmin().from("acuerdos").insert({
      conversacion_id: params.conversacionId,
      escalon: params.escalon,
      tipo: params.tipo,
      monto: params.monto,
      fecha_acordada: params.fechaAcordada,
    });
    if (error) throw new Error(error.message);
  });

  const estado: EstadoConversacion =
    params.tipo === "pase_humano" ? "escalada_humano" : "cerrada_con_acuerdo";
  await cerrarConversacion(params.conversacionId, estado);
}

export async function guardarNoAcuerdo(params: {
  conversacionId: string;
  motivo: string;
}): Promise<void> {
  if (!tieneSupabase()) {
    memoriaAcuerdos.set(params.conversacionId, params);
    await cerrarConversacion(params.conversacionId, "cerrada_sin_acuerdo");
    return;
  }

  await conReintentos("No se pudo registrar el no-acuerdo", async () => {
    const { error } = await getSupabaseAdmin().from("acuerdos").insert({
      conversacion_id: params.conversacionId,
      motivo_no_acuerdo: params.motivo,
    });
    if (error) throw new Error(error.message);
  });
  await cerrarConversacion(params.conversacionId, "cerrada_sin_acuerdo");
}

export async function cerrarConversacion(
  id: string,
  estado: EstadoConversacion,
): Promise<void> {
  if (!tieneSupabase()) {
    const conv = memoriaConversaciones.get(id);
    if (conv) conv.estado = estado;
    return;
  }

  await conReintentos("No se pudo cerrar la conversación", async () => {
    const { error } = await getSupabaseAdmin()
      .from("conversaciones")
      .update({ estado, cerrada_en: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  });
}
