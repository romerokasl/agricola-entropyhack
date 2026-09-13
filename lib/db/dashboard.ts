import { getSupabaseAdmin } from "../supabase";
import type { Apertura, Canal, Cliente, EstadoConversacion, RolTurno } from "../agent/types";
import type {
  AcuerdoFila,
  ConversacionFila,
  DatosDashboard,
  TurnoDetalle,
  TurnoMetricasFila,
} from "../dashboard/types";
import { aCliente, CLIENTES_FALLBACK, COLUMNAS_CLIENTE, obtenerClientePorId, type FilaCliente } from "./clientes";
import { memoriaAcuerdos, memoriaConversaciones, memoriaTurnos, tieneSupabase } from "./conversaciones";
import { conReintentos } from "./reintentos";

/**
 * Lectura del dashboard. Solo SELECT: el dashboard nunca escribe.
 *
 * PostgREST corta cada respuesta en 1000 filas por defecto, sin avisar. `turnos` pasa
 * ese límite con unos 200 ensayos, y un dashboard que calcula sobre filas truncadas
 * muestra números falsos sin ningún error. Por eso todo se lee paginado.
 */

const TAMANO_PAGINA = 1000;
/** Techo de seguridad: 100 páginas = 100 000 filas. Pasarlo es un error, no un recorte. */
const MAX_PAGINAS = 100;

interface RespuestaPagina {
  data: unknown[] | null;
  error: { message: string } | null;
}

async function leerTodo<T>(
  descripcion: string,
  pagina: (desde: number, hasta: number) => PromiseLike<RespuestaPagina>,
): Promise<T[]> {
  const filas: T[] = [];

  for (let n = 0; n < MAX_PAGINAS; n += 1) {
    const desde = n * TAMANO_PAGINA;
    const lote = await conReintentos(descripcion, async () => {
      const { data, error } = await pagina(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw new Error(error.message);
      return (data ?? []) as T[];
    });
    filas.push(...lote);
    if (lote.length < TAMANO_PAGINA) return filas;
  }

  throw new Error(`${descripcion}: hay más de ${MAX_PAGINAS * TAMANO_PAGINA} filas.`);
}

/** numeric de Postgres llega como string. */
const aNumero = (v: string | number | null): number | null => (v === null ? null : Number(v));

// --- Filas crudas ----------------------------------------------------------------

interface FilaConversacion {
  id: string;
  cliente_id: string;
  canal: string;
  apertura: string;
  estado: string;
  iniciada_en: string;
  cerrada_en: string | null;
}

interface FilaTurno {
  conversacion_id: string;
  indice: number;
  rol: string;
  creado_en: string;
  latencia_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  validador_ok: boolean | null;
  validador_motivo: string | null;
  modelo_version: string | null;
}

interface FilaTurnoConTexto extends FilaTurno {
  texto: string;
}

interface FilaAcuerdo {
  conversacion_id: string;
  escalon: number | null;
  tipo: string | null;
  monto: string | number | null;
  fecha_acordada: string | null;
  motivo_no_acuerdo: string | null;
  creado_en: string;
}

const COLUMNAS_CONVERSACION = "id, cliente_id, canal, apertura, estado, iniciada_en, cerrada_en";
const COLUMNAS_TURNO =
  "conversacion_id, indice, rol, creado_en, latencia_ms, tokens_in, tokens_out, validador_ok, validador_motivo, modelo_version";
const COLUMNAS_ACUERDO =
  "conversacion_id, escalon, tipo, monto, fecha_acordada, motivo_no_acuerdo, creado_en";

function aConversacion(f: FilaConversacion): ConversacionFila {
  return {
    id: f.id,
    clienteId: f.cliente_id,
    canal: f.canal as Canal,
    apertura: f.apertura as Apertura,
    estado: f.estado as EstadoConversacion,
    iniciadaEn: f.iniciada_en,
    cerradaEn: f.cerrada_en,
  };
}

function aTurno(f: FilaTurno): TurnoMetricasFila {
  return {
    conversacionId: f.conversacion_id,
    indice: f.indice,
    rol: f.rol as RolTurno,
    creadoEn: f.creado_en,
    latenciaMs: f.latencia_ms,
    tokensIn: f.tokens_in,
    tokensOut: f.tokens_out,
    validadorOk: f.validador_ok,
    validadorMotivo: f.validador_motivo,
    modeloVersion: f.modelo_version,
  };
}

function aAcuerdo(f: FilaAcuerdo): AcuerdoFila {
  return {
    conversacionId: f.conversacion_id,
    escalon: f.escalon,
    tipo: f.tipo,
    monto: aNumero(f.monto),
    fechaAcordada: f.fecha_acordada,
    motivoNoAcuerdo: f.motivo_no_acuerdo,
    creadoEn: f.creado_en,
  };
}

// --- Consultas -------------------------------------------------------------------

export async function leerDatosDashboard(): Promise<DatosDashboard> {
  if (!tieneSupabase()) {
    const clientes = Object.values(CLIENTES_FALLBACK);
    const conversaciones: ConversacionFila[] = Array.from(memoriaConversaciones.values()).map((c) => ({
      id: c.id,
      clienteId: c.clienteId,
      canal: c.canal,
      apertura: c.apertura,
      estado: c.estado,
      iniciadaEn: new Date().toISOString(),
      cerradaEn: c.estado === "abierta" ? null : new Date().toISOString(),
    }));
    const turnos: TurnoMetricasFila[] = [];
    for (const [convId, lista] of memoriaTurnos.entries()) {
      lista.forEach((t, idx) => {
        turnos.push({
          conversacionId: convId,
          indice: idx,
          rol: t.rol,
          creadoEn: new Date().toISOString(),
          latenciaMs: t.metricas?.latenciaMs ?? null,
          tokensIn: null,
          tokensOut: null,
          validadorOk: t.metricas?.validadorOk ?? true,
          validadorMotivo: null,
          modeloVersion: "llama3.1",
        });
      });
    }
    const acuerdos: AcuerdoFila[] = [];
    for (const [convId, ac] of memoriaAcuerdos.entries()) {
      const a = ac as {
        escalon?: number;
        tipo?: string;
        monto?: number | string;
        fechaAcordada?: string;
        motivo?: string;
      };
      acuerdos.push({
        conversacionId: convId,
        escalon: a.escalon ?? null,
        tipo: a.tipo ?? null,
        monto: a.monto ? Number(a.monto) : null,
        fechaAcordada: a.fechaAcordada ?? null,
        motivoNoAcuerdo: a.motivo ?? null,
        creadoEn: new Date().toISOString(),
      });
    }
    return { clientes, conversaciones, turnos, acuerdos };
  }

  const db = getSupabaseAdmin();

  // El orden explícito hace estable la paginación: sin él, dos páginas pueden repetir
  // o saltarse filas.
  const [clientes, conversaciones, turnos, acuerdos] = await Promise.all([
    leerTodo<FilaCliente>("No se pudieron leer los clientes", (desde, hasta) =>
      db.from("clientes").select(COLUMNAS_CLIENTE).order("id").range(desde, hasta),
    ),
    leerTodo<FilaConversacion>("No se pudieron leer las conversaciones", (desde, hasta) =>
      db.from("conversaciones").select(COLUMNAS_CONVERSACION).order("id").range(desde, hasta),
    ),
    leerTodo<FilaTurno>("No se pudieron leer los turnos", (desde, hasta) =>
      db
        .from("turnos")
        .select(COLUMNAS_TURNO)
        .order("conversacion_id")
        .order("indice")
        .range(desde, hasta),
    ),
    leerTodo<FilaAcuerdo>("No se pudieron leer los acuerdos", (desde, hasta) =>
      db.from("acuerdos").select(COLUMNAS_ACUERDO).order("conversacion_id").range(desde, hasta),
    ),
  ]);

  return {
    clientes: clientes.map(aCliente),
    conversaciones: conversaciones.map(aConversacion),
    turnos: turnos.map(aTurno),
    acuerdos: acuerdos.map(aAcuerdo),
  };
}

export interface DatosDetalle {
  conversacion: ConversacionFila;
  cliente: Cliente | null;
  turnos: TurnoDetalle[];
  acuerdo: AcuerdoFila | null;
}

/** `null` si la conversación no existe. El id tiene que venir ya validado como UUID. */
export async function leerDetalleConversacion(id: string): Promise<DatosDetalle | null> {
  if (!tieneSupabase()) {
    const conv = memoriaConversaciones.get(id);
    if (!conv) return null;
    const cliente = (await obtenerClientePorId(conv.clienteId)) ?? null;
    const listaTurnos = memoriaTurnos.get(id) ?? [];
    const turnos: TurnoDetalle[] = listaTurnos.map((t, idx) => ({
      conversacionId: id,
      indice: idx,
      rol: t.rol,
      creadoEn: new Date().toISOString(),
      latenciaMs: t.metricas?.latenciaMs ?? null,
      tokensIn: null,
      tokensOut: null,
      validadorOk: t.metricas?.validadorOk ?? true,
      validadorMotivo: null,
      modeloVersion: "llama3.1",
      texto: t.texto,
    }));
    const rawAcuerdo = memoriaAcuerdos.get(id) as
      | {
          escalon?: number;
          tipo?: string;
          monto?: number | string;
          fechaAcordada?: string;
          motivo?: string;
        }
      | undefined;
    const acuerdo: AcuerdoFila | null = rawAcuerdo
      ? {
          conversacionId: id,
          escalon: rawAcuerdo.escalon ?? null,
          tipo: rawAcuerdo.tipo ?? null,
          monto: rawAcuerdo.monto ? Number(rawAcuerdo.monto) : null,
          fechaAcordada: rawAcuerdo.fechaAcordada ?? null,
          motivoNoAcuerdo: rawAcuerdo.motivo ?? null,
          creadoEn: new Date().toISOString(),
        }
      : null;
    return {
      conversacion: {
        id: conv.id,
        clienteId: conv.clienteId,
        canal: conv.canal,
        apertura: conv.apertura,
        estado: conv.estado,
        iniciadaEn: new Date().toISOString(),
        cerradaEn: conv.estado === "abierta" ? null : new Date().toISOString(),
      },
      cliente,
      turnos,
      acuerdo,
    };
  }
  const db = getSupabaseAdmin();

  const conversacion = await conReintentos(`No se pudo leer la conversación ${id}`, async () => {
    const { data, error } = await db
      .from("conversaciones")
      .select(COLUMNAS_CONVERSACION)
      .eq("id", id)
      .maybeSingle<FilaConversacion>();
    if (error) throw new Error(error.message);
    return data ? aConversacion(data) : null;
  });
  if (conversacion === null) return null;

  const [cliente, turnos, acuerdo] = await Promise.all([
    obtenerClientePorId(conversacion.clienteId),
    leerTodo<FilaTurnoConTexto>("No se pudieron leer los turnos", (desde, hasta) =>
      db
        .from("turnos")
        .select(`${COLUMNAS_TURNO}, texto`)
        .eq("conversacion_id", id)
        .order("indice")
        .range(desde, hasta),
    ),
    conReintentos("No se pudo leer el acuerdo", async () => {
      const { data, error } = await db
        .from("acuerdos")
        .select(COLUMNAS_ACUERDO)
        .eq("conversacion_id", id)
        .maybeSingle<FilaAcuerdo>();
      if (error) throw new Error(error.message);
      return data ? aAcuerdo(data) : null;
    }),
  ]);

  return {
    conversacion,
    cliente,
    turnos: turnos.map((f) => ({ ...aTurno(f), texto: f.texto })),
    acuerdo,
  };
}
