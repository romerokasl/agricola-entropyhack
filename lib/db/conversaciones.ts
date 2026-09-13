import { getSupabaseAdmin } from "../supabase";
import { conReintentos } from "./reintentos";
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
  return conReintentos("No se pudo crear la conversación", async () => {
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

    if (error || !data) throw new Error(error?.message ?? "sin datos");
    return aConversacion(data);
  });
}

export function obtenerConversacion(id: string): Promise<Conversacion | null> {
  return conReintentos(`No se pudo leer la conversación ${id}`, async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("conversaciones")
      .select("id, cliente_id, canal, modo_voz, apertura, estado")
      .eq("id", id)
      .maybeSingle<FilaConversacion>();

    if (error) throw new Error(error.message);
    return data ? aConversacion(data) : null;
  });
}

export function obtenerTurnos(conversacionId: string): Promise<Turno[]> {
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
}): Promise<void> {
  const { indice, metricas } = params;

  await conReintentos("No se pudo guardar el turno", async () => {
    const { error } = await getSupabaseAdmin()
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
      });

    if (error) throw new Error(error.message);
  });
}

export async function guardarAcuerdo(params: {
  conversacionId: string;
  escalon: number;
  tipo: string;
  monto: number | null;
  fechaAcordada: string;
}): Promise<void> {
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
  await conReintentos("No se pudo cerrar la conversación", async () => {
    const { error } = await getSupabaseAdmin()
      .from("conversaciones")
      .update({ estado, cerrada_en: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  });
}
