import { getSupabaseAdmin } from "../supabase";
import type {
  Apertura,
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
}

interface FilaConversacion {
  id: string;
  cliente_id: string;
  canal: string;
  modo_voz: string | null;
  apertura: string;
  estado: string;
}

interface FilaTurno {
  rol: string;
  texto: string;
}

function aConversacion(fila: FilaConversacion): Conversacion {
  return {
    id: fila.id,
    clienteId: fila.cliente_id,
    canal: fila.canal as Canal,
    modoVoz: fila.modo_voz as ModoVoz | null,
    apertura: fila.apertura as Apertura,
    estado: fila.estado as EstadoConversacion,
  };
}

export async function crearConversacion(params: {
  clienteId: string;
  canal: Canal;
  modoVoz: ModoVoz | null;
  apertura: Apertura;
}): Promise<Conversacion> {
  const { data, error } = await getSupabaseAdmin()
    .from("conversaciones")
    .insert({
      cliente_id: params.clienteId,
      canal: params.canal,
      modo_voz: params.modoVoz,
      apertura: params.apertura,
    })
    .select("id, cliente_id, canal, modo_voz, apertura, estado")
    .single<FilaConversacion>();

  if (error || !data) {
    throw new Error(`No se pudo crear la conversación: ${error?.message ?? "sin datos"}`);
  }
  return aConversacion(data);
}

export async function obtenerConversacion(id: string): Promise<Conversacion | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("conversaciones")
    .select("id, cliente_id, canal, modo_voz, apertura, estado")
    .eq("id", id)
    .maybeSingle<FilaConversacion>();

  if (error) throw new Error(`No se pudo leer la conversación ${id}: ${error.message}`);
  return data ? aConversacion(data) : null;
}

export async function obtenerTurnos(conversacionId: string): Promise<Turno[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("turnos")
    .select("rol, texto")
    .eq("conversacion_id", conversacionId)
    .order("indice", { ascending: true });

  if (error) throw new Error(`No se pudieron leer los turnos: ${error.message}`);
  return ((data ?? []) as FilaTurno[]).map((f) => ({ rol: f.rol as RolTurno, texto: f.texto }));
}

async function siguienteIndice(conversacionId: string): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from("turnos")
    .select("indice")
    .eq("conversacion_id", conversacionId)
    .order("indice", { ascending: false })
    .limit(1)
    .maybeSingle<{ indice: number }>();

  if (error) throw new Error(`No se pudo calcular el índice del turno: ${error.message}`);
  return data ? data.indice + 1 : 0;
}

/**
 * Guarda un turno con sus métricas. Es la transcripción que el banco pide como
 * evidencia técnica, y la fuente de las métricas del dashboard.
 */
export async function agregarTurno(params: {
  conversacionId: string;
  rol: RolTurno;
  texto: string;
  metricas?: MetricasTurno;
}): Promise<void> {
  const indice = await siguienteIndice(params.conversacionId);
  const { metricas } = params;

  const { error } = await getSupabaseAdmin().from("turnos").insert({
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
  });

  if (error) throw new Error(`No se pudo guardar el turno: ${error.message}`);
}

export async function guardarAcuerdo(params: {
  conversacionId: string;
  escalon: number;
  tipo: string;
  monto: number | null;
  fechaAcordada: string;
}): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("acuerdos").insert({
    conversacion_id: params.conversacionId,
    escalon: params.escalon,
    tipo: params.tipo,
    monto: params.monto,
    fecha_acordada: params.fechaAcordada,
  });

  if (error) throw new Error(`No se pudo registrar el acuerdo: ${error.message}`);

  const estado: EstadoConversacion =
    params.tipo === "pase_humano" ? "escalada_humano" : "cerrada_con_acuerdo";
  await cerrarConversacion(params.conversacionId, estado);
}

export async function guardarNoAcuerdo(params: {
  conversacionId: string;
  motivo: string;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("acuerdos").insert({
    conversacion_id: params.conversacionId,
    motivo_no_acuerdo: params.motivo,
  });

  if (error) throw new Error(`No se pudo registrar el no-acuerdo: ${error.message}`);
  await cerrarConversacion(params.conversacionId, "cerrada_sin_acuerdo");
}

export async function cerrarConversacion(id: string, estado: EstadoConversacion): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("conversaciones")
    .update({ estado, cerrada_en: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`No se pudo cerrar la conversación: ${error.message}`);
}
