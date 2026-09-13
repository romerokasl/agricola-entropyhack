import { getSupabaseAdmin } from "../supabase";
import type { BandaRiesgo, Cliente, TipoIngreso } from "../agent/types";
import { conReintentos } from "./reintentos";

export interface FilaCliente {
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

export const COLUMNAS_CLIENTE =
  "id, slug, nombre, edad, distrito, segmento, tipo_ingreso, dia_ingreso_1, dia_ingreso_2, dia_remesa, producto, cuota, saldo, dia_pago, dias_atraso, tiene_debito_automatico, riesgo_score, riesgo_banda";

export function aCliente(fila: FilaCliente): Cliente {
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

const CLIENTES_FALLBACK: Record<string, Cliente> = {
  karla: {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "karla",
    nombre: "Karla Menjívar",
    edad: 27,
    distrito: "Soyapango",
    segmento: "Asalariado",
    tipoIngreso: "quincenal",
    diaIngreso1: 15,
    diaIngreso2: 30,
    diaRemesa: null,
    producto: "Tarjeta de crédito",
    cuota: 145,
    saldo: 1240,
    diaPago: 8,
    diasAtraso: 0,
    tieneDebitoAutomatico: false,
    riesgoScore: 62,
    riesgoBanda: "MODERATE_HIGH",
  },
  jose: {
    id: "00000000-0000-0000-0000-000000000002",
    slug: "jose",
    nombre: "José Portillo",
    edad: 41,
    distrito: "Chalatenango",
    segmento: "Remesas",
    tipoIngreso: "mensual",
    diaIngreso1: 5,
    diaIngreso2: null,
    diaRemesa: 5,
    producto: "Crédito personal",
    cuota: 98.5,
    saldo: 2150,
    diaPago: 3,
    diasAtraso: 0,
    tieneDebitoAutomatico: false,
    riesgoScore: 58,
    riesgoBanda: "MODERATE_HIGH",
  },
  wilber: {
    id: "00000000-0000-0000-0000-000000000003",
    slug: "wilber",
    nombre: "Wilber Alvarenga",
    edad: 23,
    distrito: "Santa Tecla",
    segmento: "Joven",
    tipoIngreso: "quincenal",
    diaIngreso1: 15,
    diaIngreso2: 30,
    diaRemesa: null,
    producto: "Tarjeta de crédito",
    cuota: 65,
    saldo: 480,
    diaPago: 15,
    diasAtraso: 6,
    tieneDebitoAutomatico: false,
    riesgoScore: 68,
    riesgoBanda: "MODERATE_HIGH",
  },
  sandra: {
    id: "00000000-0000-0000-0000-000000000004",
    slug: "sandra",
    nombre: "Sandra Beltrán",
    edad: 29,
    distrito: "Mejicanos",
    segmento: "Asalariado",
    tipoIngreso: "quincenal",
    diaIngreso1: 15,
    diaIngreso2: 30,
    diaRemesa: null,
    producto: "Crédito personal",
    cuota: 210,
    saldo: 1680,
    diaPago: 20,
    diasAtraso: 0,
    tieneDebitoAutomatico: false,
    riesgoScore: 56,
    riesgoBanda: "MODERATE_HIGH",
  },
  rosa: {
    id: "00000000-0000-0000-0000-000000000005",
    slug: "rosa",
    nombre: "Rosa Hernández",
    edad: 52,
    distrito: "San Miguel",
    segmento: "Independiente",
    tipoIngreso: "irregular",
    diaIngreso1: 1,
    diaIngreso2: null,
    diaRemesa: null,
    producto: "Crédito personal",
    cuota: 175,
    saldo: 3200,
    diaPago: 10,
    diasAtraso: 0,
    tieneDebitoAutomatico: false,
    riesgoScore: 64,
    riesgoBanda: "MODERATE_HIGH",
  },
  nelson: {
    id: "00000000-0000-0000-0000-000000000006",
    slug: "nelson",
    nombre: "Nelson Rivas",
    edad: 38,
    distrito: "Ahuachapán",
    segmento: "Asalariado",
    tipoIngreso: "mensual",
    diaIngreso1: 30,
    diaIngreso2: null,
    diaRemesa: null,
    producto: "Extrafinanciamiento",
    cuota: 240,
    saldo: 4100,
    diaPago: 25,
    diasAtraso: 0,
    tieneDebitoAutomatico: false,
    riesgoScore: 59,
    riesgoBanda: "MODERATE_HIGH",
  },
  tito: {
    id: "00000000-0000-0000-0000-000000000007",
    slug: "tito",
    nombre: "Tito Guevara",
    edad: 67,
    distrito: "Santa Ana",
    segmento: "Senior",
    tipoIngreso: "mensual",
    diaIngreso1: 1,
    diaIngreso2: null,
    diaRemesa: null,
    producto: "Tarjeta de crédito",
    cuota: 52,
    saldo: 310,
    diaPago: 5,
    diasAtraso: 2,
    tieneDebitoAutomatico: false,
    riesgoScore: 51,
    riesgoBanda: "MODERATE",
  },
  marta: {
    id: "00000000-0000-0000-0000-000000000008",
    slug: "marta",
    nombre: "Marta Cruz",
    edad: 34,
    distrito: "Antiguo Cuscatlán",
    segmento: "Asalariado",
    tipoIngreso: "quincenal",
    diaIngreso1: 15,
    diaIngreso2: 30,
    diaRemesa: null,
    producto: "Crédito de vehículo",
    cuota: 320,
    saldo: 5400,
    diaPago: 20,
    diasAtraso: 0,
    tieneDebitoAutomatico: true,
    riesgoScore: 8,
    riesgoBanda: "LOW",
  },
};

function tieneSupabase(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("example.supabase.co"),
  );
}

function buscarPor(campo: "slug" | "id", valor: string): Promise<Cliente | null> {
  if (!tieneSupabase()) {
    if (campo === "slug") {
      return Promise.resolve(CLIENTES_FALLBACK[valor] ?? null);
    }
    const c = Object.values(CLIENTES_FALLBACK).find((item) => item.id === valor);
    return Promise.resolve(c ?? null);
  }

  return conReintentos(`No se pudo leer el cliente ${valor}`, async () => {
    const { data, error } = await getSupabaseAdmin()
      .from("clientes")
      .select(COLUMNAS_CLIENTE)
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
