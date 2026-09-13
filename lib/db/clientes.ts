import { getSupabaseAdmin } from "../supabase";
import type { BandaRiesgo, Cliente, TipoIngreso } from "../agent/types";
import { conReintentos } from "./reintentos";

interface FilaCliente {
  id: string;
  slug: string;
  nombre: string;
  edad: number | null;
  distrito: string;
  segmento: string;
  tipo_ingreso: string;
  dia_ingreso_1: number;
  dia_ingreso_2: number | null;
  dia_remesa: number | null;
  producto: string;
  cuota: string | number;
  saldo: string | number;
  dia_pago: number;
  dias_atraso: number;
  tiene_debito_automatico: boolean;
  riesgo_score: number | null;
  riesgo_banda: string | null;
}

const COLUMNAS =
  "id, slug, nombre, edad, distrito, segmento, tipo_ingreso, dia_ingreso_1, dia_ingreso_2, dia_remesa, producto, cuota, saldo, dia_pago, dias_atraso, tiene_debito_automatico, riesgo_score, riesgo_banda";

function aCliente(fila: FilaCliente): Cliente {
  return {
    id: fila.id,
    slug: fila.slug,
    nombre: fila.nombre,
    edad: fila.edad,
    distrito: fila.distrito,
    segmento: fila.segmento,
    tipoIngreso: fila.tipo_ingreso as TipoIngreso,
    diaIngreso1: fila.dia_ingreso_1,
    diaIngreso2: fila.dia_ingreso_2,
    diaRemesa: fila.dia_remesa,
    producto: fila.producto,
    // numeric de Postgres llega como string: convertirlo explícitamente evita que un
    // monto se concatene en vez de sumarse.
    cuota: Number(fila.cuota),
    saldo: Number(fila.saldo),
    diaPago: fila.dia_pago,
    diasAtraso: fila.dias_atraso,
    tieneDebitoAutomatico: fila.tiene_debito_automatico,
    riesgoScore: fila.riesgo_score,
    riesgoBanda: fila.riesgo_banda as BandaRiesgo | null,
  };
}

function buscarPor(campo: "slug" | "id", valor: string): Promise<Cliente | null> {
  return conReintentos(`No se pudo leer el cliente ${valor}`, async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("clientes")
      .select(COLUMNAS)
      .eq(campo, valor)
      .maybeSingle<FilaCliente>();

    if (error) throw new Error(error.message);
    return data ? aCliente(data) : null;
  });
}

export function obtenerClientePorSlug(slug: string): Promise<Cliente | null> {
  return buscarPor("slug", slug);
}

export function obtenerClientePorId(id: string): Promise<Cliente | null> {
  return buscarPor("id", id);
}
