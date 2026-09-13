/**
 * Generador determinista del dataset de juguete.
 *
 * Escribe `supabase/seed.sql` con los 8 personajes del pitch (a mano, porque cada uno
 * existe para demostrar un patrón de conversación distinto) más SYNTHETIC_COUNT
 * clientes generados, para que el panel de riesgo del dashboard no se vea con 8 filas.
 *
 * Es determinista: misma semilla, mismo archivo byte a byte. Eso permite commitear el
 * `seed.sql` resultante y que cualquiera lo aplique sin tener Node.
 *
 * Uso:  node scripts/generate-seed.mjs
 *
 * Para modificarlo, ver la sección "Generador de datos" en supabase/README.md — ahí
 * está documentado qué controla cada constante.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SEED = 20260912;
const SYNTHETIC_COUNT = 300;

// ---------------------------------------------------------------------------
// PRNG con semilla (mulberry32). Math.random() no sirve: no es reproducible.
// ---------------------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
const money = (min, max) => (min + rand() * (max - min)).toFixed(2);
const chance = (p) => rand() < p;

// ---------------------------------------------------------------------------
// Pools de datos (El Salvador)
// ---------------------------------------------------------------------------

const NOMBRES = [
  "Ana", "Carlos", "María", "Josué", "Gabriela", "Luis", "Claudia", "Mauricio",
  "Verónica", "Óscar", "Jacqueline", "Ricardo", "Evelyn", "Fredy", "Morena",
  "Salvador", "Xiomara", "Douglas", "Yesenia", "Edwin", "Blanca", "Rafael",
  "Lorena", "Alexis", "Patricia", "Walter", "Silvia", "Iván", "Reina", "Moisés",
];

const APELLIDOS = [
  "Hernández", "Martínez", "García", "Ramírez", "López", "Flores", "Rivera",
  "Sánchez", "Cruz", "Gómez", "Vásquez", "Castillo", "Aguilar", "Pérez",
  "Mejía", "Orellana", "Escobar", "Zelaya", "Chávez", "Portillo", "Bonilla",
  "Cardona", "Quintanilla", "Interiano", "Alvarenga", "Menjívar", "Guevara",
];

const DISTRITOS = [
  "San Salvador", "Soyapango", "Mejicanos", "Santa Tecla", "Apopa", "Ilopango",
  "Delgado", "San Marcos", "Santa Ana", "San Miguel", "Sonsonate", "Ahuachapán",
  "La Libertad", "Usulután", "Chalatenango", "Cojutepeque", "Zacatecoluca",
  "Antiguo Cuscatlán", "Nejapa", "Quezaltepeque",
];

const PRODUCTOS = ["Tarjeta de crédito", "Crédito personal", "Extrafinanciamiento", "Crédito de vehículo"];

// ---------------------------------------------------------------------------
// Los 8 personajes del pitch. Cada uno demuestra un patrón distinto.
// Ver docs/contexto/01-reglas-del-agente.md §7.
// ---------------------------------------------------------------------------

const PERSONAJES = [
  {
    slug: "karla", nombre: "Karla Menjívar", edad: 27, distrito: "Soyapango",
    segmento: "Asalariado", tipo_ingreso: "quincenal", dia_ingreso_1: 15, dia_ingreso_2: 30,
    dia_remesa: null, producto: "Tarjeta de crédito", cuota: "145.00", saldo: "1240.00",
    dia_pago: 8, dias_atraso: 0, tiene_debito_automatico: false,
    riesgo_score: 62, riesgo_banda: "MODERATE_HIGH",
    // ⭐ Caso estrella: cobra el 15 y el 30, la cuota vence el 8. Falla todos los
    // meses sin ser mala pagadora. Mover la fecha al 16 cuesta cero.
  },
  {
    slug: "jose", nombre: "José Portillo", edad: 41, distrito: "Chalatenango",
    segmento: "Remesas", tipo_ingreso: "mensual", dia_ingreso_1: 5, dia_ingreso_2: null,
    dia_remesa: 5, producto: "Crédito personal", cuota: "98.50", saldo: "2150.00",
    dia_pago: 3, dias_atraso: 0, tiene_debito_automatico: false,
    riesgo_score: 58, riesgo_banda: "MODERATE_HIGH",
    // La remesa entra el 5, la cuota vence el 3. Dos días que generan mora 12 veces
    // al año. Ningún buró tiene esta señal.
  },
  {
    slug: "wilber", nombre: "Wilber Alvarenga", edad: 23, distrito: "Santa Tecla",
    segmento: "Joven", tipo_ingreso: "quincenal", dia_ingreso_1: 15, dia_ingreso_2: 30,
    dia_remesa: null, producto: "Tarjeta de crédito", cuota: "65.00", saldo: "480.00",
    dia_pago: 15, dias_atraso: 6, tiene_debito_automatico: false,
    riesgo_score: 68, riesgo_banda: "MODERATE_HIGH",
    // Ya atrasado 6 días. El contador honesto de la ventana del buró.
  },
  {
    slug: "sandra", nombre: "Sandra Beltrán", edad: 29, distrito: "Mejicanos",
    segmento: "Asalariado", tipo_ingreso: "quincenal", dia_ingreso_1: 15, dia_ingreso_2: 30,
    dia_remesa: null, producto: "Crédito personal", cuota: "210.00", saldo: "1680.00",
    dia_pago: 20, dias_atraso: 0, tiene_debito_automatico: false,
    riesgo_score: 56, riesgo_banda: "MODERATE_HIGH",
    // Junta $170 de $210. Abono parcial que evita el deterioro de categoría.
  },
  {
    slug: "rosa", nombre: "Rosa Hernández", edad: 52, distrito: "San Miguel",
    segmento: "Independiente", tipo_ingreso: "irregular", dia_ingreso_1: 1, dia_ingreso_2: null,
    dia_remesa: null, producto: "Crédito personal", cuota: "175.00", saldo: "3200.00",
    dia_pago: 10, dias_atraso: 0, tiene_debito_automatico: false,
    riesgo_score: 64, riesgo_banda: "MODERATE_HIGH",
    // Tienda; los ingresos caen 40 % en septiembre. Micro-plan de dos cuotas.
  },
  {
    slug: "nelson", nombre: "Nelson Rivas", edad: 38, distrito: "Ahuachapán",
    segmento: "Asalariado", tipo_ingreso: "mensual", dia_ingreso_1: 30, dia_ingreso_2: null,
    dia_remesa: null, producto: "Extrafinanciamiento", cuota: "240.00", saldo: "4100.00",
    dia_pago: 25, dias_atraso: 0, tiene_debito_automatico: false,
    riesgo_score: 59, riesgo_banda: "MODERATE_HIGH",
    // Sube su extrafinanciamiento 4 meses seguidos. Intervenir temprano, sin atraso.
  },
  {
    slug: "tito", nombre: "Tito Guevara", edad: 67, distrito: "Santa Ana",
    segmento: "Senior", tipo_ingreso: "mensual", dia_ingreso_1: 1, dia_ingreso_2: null,
    dia_remesa: null, producto: "Tarjeta de crédito", cuota: "52.00", saldo: "310.00",
    dia_pago: 5, dias_atraso: 2, tiene_debito_automatico: false,
    riesgo_score: 51, riesgo_banda: "MODERATE",
    // No usa smartphone. Canal SMS + corresponsal. Responde la objeción del jurado.
  },
  {
    slug: "marta", nombre: "Marta Cruz", edad: 34, distrito: "Antiguo Cuscatlán",
    segmento: "Asalariado", tipo_ingreso: "quincenal", dia_ingreso_1: 15, dia_ingreso_2: 30,
    dia_remesa: null, producto: "Crédito de vehículo", cuota: "320.00", saldo: "5400.00",
    dia_pago: 20, dias_atraso: 0, tiene_debito_automatico: true,
    riesgo_score: 8, riesgo_banda: "LOW",
    // ⭐ EL CONTROL. Paga adelantado desde hace 3 años. El sistema decide NO
    // contactarla, y eso se deriva de sus datos (riesgo bajo, sin atraso, calendario
    // alineado, con débito automático) — no de un flag. Es la diferencia entre un
    // modelo y un megáfono.
  },
];

// ---------------------------------------------------------------------------
// Generación sintética
// ---------------------------------------------------------------------------

/**
 * El score se deriva de las mismas señales que disparan una conversación, para que el
 * panel "clientes en riesgo por banda" sea coherente con los casos que el agente
 * realmente abre. Si el score fuera ruido puro, el dashboard contradiría al agente.
 */
function derivarRiesgo({ tipo_ingreso, dia_pago, dia_remesa, dias_atraso, tiene_debito_automatico }) {
  // Los pesos están calibrados para que un cliente sintético con el perfil de Karla
  // caiga en la misma banda que Karla (MODERATE_HIGH), y uno con el perfil de Marta
  // en la de Marta (LOW). Si no coincidieran, el dashboard contradiría al agente.
  let score = 18;
  if (tipo_ingreso === "quincenal" && dia_pago >= 5 && dia_pago <= 12) score += 40;
  if (dia_remesa !== null && dia_remesa > dia_pago) score += 38;
  if (tipo_ingreso === "irregular") score += 12;
  score += Math.min(dias_atraso * 3, 36);
  if (tiene_debito_automatico) score -= 14;
  score += between(-6, 6);
  score = Math.max(2, Math.min(97, score));

  let banda = "LOW";
  if (score >= 75) banda = "CRITICAL";
  else if (score >= 55) banda = "MODERATE_HIGH";
  else if (score >= 30) banda = "MODERATE";

  return { riesgo_score: score, riesgo_banda: banda };
}

function generarCliente(i) {
  const tipo_ingreso = chance(0.62) ? "quincenal" : chance(0.6) ? "mensual" : "irregular";
  const esQuincenal = tipo_ingreso === "quincenal";

  // ~35 % de los quincenales quedan desalineados: la cuota vence entre el 5 y el 12,
  // es decir antes de que entre la quincena. Es el patrón que el agente detecta.
  const desalineado = esQuincenal && chance(0.35);
  const dia_pago = desalineado ? between(5, 12) : between(13, 28);

  const conRemesa = chance(0.15);
  const dia_remesa = conRemesa
    ? (chance(0.5) ? Math.min(dia_pago + between(1, 4), 31) : between(1, 28))
    : null;

  const dias_atraso = chance(0.2) ? between(1, 25) : 0;
  const tiene_debito_automatico = chance(0.25);

  const base = { tipo_ingreso, dia_pago, dia_remesa, dias_atraso, tiene_debito_automatico };
  const cuota = money(35, 420);

  return {
    slug: `cliente-${String(i).padStart(3, "0")}`,
    nombre: `${pick(NOMBRES)} ${pick(APELLIDOS)}`,
    edad: between(21, 69),
    distrito: pick(DISTRITOS),
    segmento: conRemesa ? "Remesas" : tipo_ingreso === "irregular" ? "Independiente" : "Asalariado",
    tipo_ingreso,
    dia_ingreso_1: esQuincenal ? 15 : between(1, 30),
    dia_ingreso_2: esQuincenal ? 30 : null,
    dia_remesa,
    producto: pick(PRODUCTOS),
    cuota,
    saldo: money(Number(cuota) * 3, Number(cuota) * 26),
    dia_pago,
    dias_atraso,
    tiene_debito_automatico,
    ...derivarRiesgo(base),
  };
}

// ---------------------------------------------------------------------------
// Emisión del SQL
// ---------------------------------------------------------------------------

const COLUMNAS = [
  "slug", "nombre", "edad", "distrito", "segmento", "tipo_ingreso",
  "dia_ingreso_1", "dia_ingreso_2", "dia_remesa", "producto", "cuota", "saldo",
  "dia_pago", "dias_atraso", "tiene_debito_automatico", "riesgo_score", "riesgo_banda",
];

const sqlLiteral = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};

const fila = (c) => `  (${COLUMNAS.map((col) => sqlLiteral(c[col])).join(", ")})`;

const sinteticos = Array.from({ length: SYNTHETIC_COUNT }, (_, i) => generarCliente(i + 1));
const todos = [...PERSONAJES, ...sinteticos];

const bandas = todos.reduce((acc, c) => {
  acc[c.riesgo_banda] = (acc[c.riesgo_banda] ?? 0) + 1;
  return acc;
}, {});

const sql = `-- GENERADO AUTOMÁTICAMENTE por scripts/generate-seed.mjs — no editar a mano.
-- Regenerar con:  node scripts/generate-seed.mjs
--
-- Semilla: ${SEED} (determinista: misma semilla, mismo archivo byte a byte)
-- Clientes: ${todos.length} (${PERSONAJES.length} personajes del pitch + ${SYNTHETIC_COUNT} sintéticos)
-- Distribución por banda de riesgo: ${Object.entries(bandas).sort().map(([k, v]) => `${k}=${v}`).join(" · ")}
--
-- Dataset de juguete, autorizado explícitamente por el banco en el Q&A del brief.
-- Qué controla qué está documentado en supabase/README.md.

truncate acuerdos, turnos, conversaciones, clientes cascade;

insert into clientes (${COLUMNAS.join(", ")}) values
${todos.map(fila).join(",\n")};
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "supabase", "seed.sql");
writeFileSync(out, sql, "utf8");

console.log(`seed.sql escrito: ${todos.length} clientes`);
console.log(`  personajes: ${PERSONAJES.map((p) => p.slug).join(", ")}`);
console.log(`  bandas: ${Object.entries(bandas).sort().map(([k, v]) => `${k}=${v}`).join(" · ")}`);
