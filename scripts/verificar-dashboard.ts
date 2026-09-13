/**
 * Verificación del cálculo del dashboard.
 *
 * No toca red ni base de datos: corre las funciones puras de lib/dashboard contra
 * fixtures. Cubre lo que más vergüenza daría en vivo: un NaN en pantalla tras
 * `demo:reset`, un 100 % calculado sobre la nada, la cuota de Karla sumada una vez por
 * cada ensayo, y un costo inventado para un modelo sin precio.
 *
 * Uso:  npm run verify:dashboard
 */

import assert from "node:assert/strict";

import type { Cliente } from "../lib/agent/types";
import {
  calcularResumen,
  costoEstimado,
  distribucion,
  enmascararNombre,
  percentil,
} from "../lib/dashboard/metricas";
import { categoriaConsumo, reservaEvitadaUsd } from "../lib/dashboard/ncb022";
import type {
  AcuerdoFila,
  ConversacionFila,
  DatosDashboard,
  TurnoMetricasFila,
} from "../lib/dashboard/types";

/** Fecha fija: el diagnóstico de contacto depende del día. */
const HOY = new Date(2026, 8, 12);

const karla: Cliente = {
  id: "cli-karla", slug: "karla", nombre: "Karla Menjívar", edad: 27, distrito: "Soyapango",
  segmento: "Asalariado", tipoIngreso: "quincenal", diaIngreso1: 15, diaIngreso2: 30,
  diaRemesa: null, producto: "Tarjeta de crédito", cuota: 145, saldo: 1240, diaPago: 8,
  diasAtraso: 0, tieneDebitoAutomatico: false, riesgoScore: 62, riesgoBanda: "MODERATE_HIGH",
};

const marta: Cliente = {
  ...karla, id: "cli-marta", slug: "marta", nombre: "Marta Cruz", producto: "Crédito de vehículo",
  cuota: 320, saldo: 5400, diaPago: 20, tieneDebitoAutomatico: true, riesgoScore: 8, riesgoBanda: "LOW",
};

const wilber: Cliente = {
  ...karla, id: "cli-wilber", slug: "wilber", nombre: "Wilber Alvarenga", diaPago: 15,
  diasAtraso: 6, cuota: 80, saldo: 1000, riesgoBanda: null,
};

function conversacion(id: string, clienteId: string, estado: ConversacionFila["estado"], min: number | null): ConversacionFila {
  const inicio = Date.UTC(2026, 8, 12, 15, 0, 0);
  return {
    id, clienteId, canal: "texto", apertura: "agente", estado,
    iniciadaEn: new Date(inicio).toISOString(),
    cerradaEn: min === null ? null : new Date(inicio + min * 60_000).toISOString(),
  };
}

function turnoAgente(conversacionId: string, indice: number, extra: Partial<TurnoMetricasFila> = {}): TurnoMetricasFila {
  return {
    conversacionId, indice, rol: "agente", creadoEn: "2026-09-12T15:00:00.000Z",
    latenciaMs: 5000, tokensIn: 2000, tokensOut: 100, validadorOk: true, validadorMotivo: null,
    modeloVersion: "gemini-3.6-flash/v3", ...extra,
  };
}

function turnoCliente(conversacionId: string, indice: number): TurnoMetricasFila {
  return {
    conversacionId, indice, rol: "cliente", creadoEn: "2026-09-12T15:00:00.000Z",
    latenciaMs: null, tokensIn: null, tokensOut: null, validadorOk: null, validadorMotivo: null,
    modeloVersion: null,
  };
}

function acuerdo(conversacionId: string, extra: Partial<AcuerdoFila>): AcuerdoFila {
  return {
    conversacionId, escalon: null, tipo: null, monto: null, fechaAcordada: null,
    motivoNoAcuerdo: null, creadoEn: "2026-09-12T15:05:00.000Z", ...extra,
  };
}

/** Recorre todo el resumen buscando un número que la UI no pueda mostrar. */
function sinNumerosInvalidos(valor: unknown, ruta = "resumen"): void {
  if (typeof valor === "number") {
    assert.ok(Number.isFinite(valor), `${ruta} = ${valor}`);
  } else if (Array.isArray(valor)) {
    valor.forEach((v, i) => sinNumerosInvalidos(v, `${ruta}[${i}]`));
  } else if (valor !== null && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) sinNumerosInvalidos(v, `${ruta}.${k}`);
  }
}

const cerca = (real: number, esperado: number) =>
  assert.ok(Math.abs(real - esperado) < 1e-9, `${real} ≠ ${esperado}`);

// --- Escenarios ------------------------------------------------------------------

const vacia: DatosDashboard = { clientes: [karla, marta], conversaciones: [], turnos: [], acuerdos: [] };

/** El flujo de Karla tal como quedó en la base el 12 de septiembre. */
const soloKarla: DatosDashboard = {
  clientes: [karla, marta],
  conversaciones: [conversacion("conv-k1", karla.id, "cerrada_con_acuerdo", 2)],
  turnos: [
    turnoAgente("conv-k1", 0, { latenciaMs: 4800 }),
    turnoCliente("conv-k1", 1),
    turnoAgente("conv-k1", 2, { latenciaMs: 5000 }),
    turnoCliente("conv-k1", 3),
    turnoAgente("conv-k1", 4, { latenciaMs: 7300 }),
  ],
  acuerdos: [acuerdo("conv-k1", { escalon: 2, tipo: "mover_fecha", monto: 145, fechaAcordada: "2026-09-16" })],
};

/** Varias conversaciones con todos los nulos que aparecen en la práctica. */
const variasConNulos: DatosDashboard = {
  clientes: [karla, marta, wilber],
  conversaciones: [
    conversacion("conv-k1", karla.id, "cerrada_con_acuerdo", 2),
    conversacion("conv-k2", karla.id, "cerrada_con_acuerdo", 4), // ensayo repetido
    conversacion("conv-w1", wilber.id, "cerrada_sin_acuerdo", 6),
    conversacion("conv-w2", wilber.id, "escalada_humano", 3),
    conversacion("conv-a1", wilber.id, "abierta", null), // ensayo abandonado
  ],
  turnos: [
    turnoAgente("conv-k1", 0, { latenciaMs: 1000 }),
    turnoAgente("conv-k2", 0, { latenciaMs: 2000, tokensIn: null, tokensOut: null }),
    turnoAgente("conv-w1", 0, { latenciaMs: 3000, validadorOk: false, validadorMotivo: "monto_inventado" }),
    turnoAgente("conv-w2", 0, { latenciaMs: null, modeloVersion: "modelo-sin-precio/v3" }),
    turnoCliente("conv-a1", 0),
  ],
  acuerdos: [
    acuerdo("conv-k1", { escalon: 2, tipo: "mover_fecha", monto: 145, fechaAcordada: "2026-09-16" }),
    acuerdo("conv-k2", { escalon: 4, tipo: "debito_automatico", monto: null }),
    acuerdo("conv-w1", { motivoNoAcuerdo: "No puede comprometer fecha" }),
    acuerdo("conv-w2", { escalon: 8, tipo: "pase_humano" }),
  ],
};

// ---------------------------------------------------------------------------------

const pruebas: Array<[string, () => void]> = [
  // --- Primitivas ---------------------------------------------------------------
  ["Percentil nearest-rank sobre 10 valores", () => {
    const valores = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    assert.equal(percentil(valores, 50), 500);
    assert.equal(percentil(valores, 95), 1000);
  }],
  ["Percentil con un solo valor devuelve ese valor, y sin valores devuelve null", () => {
    assert.equal(percentil([4800], 95), 4800);
    assert.equal(percentil([], 50), null);
    assert.deepEqual(distribucion([]), { n: 0, p50: null, p95: null, max: null });
  }],
  ["El percentil no depende del orden de entrada", () => {
    assert.equal(percentil([7300, 4800, 5000], 50), 5000);
  }],
  ["Nombres enmascarados", () => {
    assert.equal(enmascararNombre("Karla Menjívar"), "K. M*****");
    assert.equal(enmascararNombre("ana"), "A.*****");
    assert.equal(enmascararNombre("   "), "—");
  }],

  // --- NCB-022 ------------------------------------------------------------------
  ["Categorías de consumo en los bordes de la tabla", () => {
    assert.equal(categoriaConsumo(0), "A1");
    assert.equal(categoriaConsumo(7), "A1");
    assert.equal(categoriaConsumo(8), "A2");
    assert.equal(categoriaConsumo(30), "A2");
    assert.equal(categoriaConsumo(31), "B");
    assert.equal(categoriaConsumo(180), "D2");
    assert.equal(categoriaConsumo(181), "E");
  }],
  ["Reserva evitada: al día pasa de A1 a A2, con atraso de A1 a B", () => {
    cerca(reservaEvitadaUsd(1240, 0), 12.4);
    cerca(reservaEvitadaUsd(1000, 6), 50);
  }],

  // --- Costo --------------------------------------------------------------------
  ["Costo con precio de lista: 2,000 in + 100 out en gemini-3.6-flash", () => {
    const c = costoEstimado([turnoAgente("x", 0)], 1, 1);
    cerca(c.totalUsd, (2000 * 0.75 + 100 * 3.75) / 1_000_000);
    assert.equal(c.turnosCosteados, 1);
  }],
  ["Un modelo sin precio NO se estima: se reporta aparte", () => {
    const c = costoEstimado([turnoAgente("x", 0, { modeloVersion: "modelo-nuevo/v3" })], 1, 0);
    assert.equal(c.totalUsd, 0);
    assert.equal(c.turnosSinPrecio, 1);
    assert.deepEqual(c.modelosSinPrecio, ["modelo-nuevo"]);
    assert.equal(c.porAcuerdoUsd, null);
  }],

  // --- Base vacía (estado tras demo:reset) --------------------------------------
  ["Base vacía: ningún NaN ni Infinity en todo el resumen", () => {
    sinNumerosInvalidos(calcularResumen(vacia, HOY));
  }],
  ["Base vacía: las tasas quedan en null con denominador 0", () => {
    const r = calcularResumen(vacia, HOY);
    assert.deepEqual(r.gestion.cierreConAcuerdo, { numerador: 0, denominador: 0, valor: null });
    assert.equal(r.tecnico.validador.intervencion.valor, null);
    assert.equal(r.tecnico.latenciaAgenteMs.n, 0);
    assert.equal(r.tecnico.costo.porConversacionUsd, null);
    assert.equal(r.tecnico.tokens.promedioPorConversacion.entrada, null);
  }],
  ["Base vacía: los 8 escalones aparecen, en 0", () => {
    const r = calcularResumen(vacia, HOY);
    assert.equal(r.gestion.acuerdosPorEscalon.length, 8);
    assert.ok(r.gestion.acuerdosPorEscalon.every((e) => e.cantidad === 0));
    assert.deepEqual(r.auditoria, []);
  }],
  ["La cartera se calcula aunque no haya conversaciones", () => {
    const r = calcularResumen(vacia, HOY);
    assert.equal(r.cartera.totalClientes, 2);
    assert.equal(r.cartera.requierenContacto.total, 1); // Karla sí, Marta no
    assert.equal(r.cartera.requierenContacto.porMotivo.desalineacion_quincena, 1);
    assert.equal(r.cartera.porBanda.LOW, 1);
  }],

  // --- Una conversación ---------------------------------------------------------
  ["Karla: 1 de 1 cerrada con acuerdo, con su n", () => {
    const r = calcularResumen(soloKarla, HOY);
    assert.deepEqual(r.gestion.cierreConAcuerdo, { numerador: 1, denominador: 1, valor: 1 });
    assert.equal(r.gestion.acuerdosPorEscalon.find((e) => e.id === "mover_fecha")?.cantidad, 1);
    assert.deepEqual(r.gestion.cuotasProtegidas, { montoUsd: 145, clientes: 1 });
  }],
  ["Karla: la latencia solo cuenta turnos del agente", () => {
    const r = calcularResumen(soloKarla, HOY);
    assert.deepEqual(r.tecnico.latenciaAgenteMs, { n: 3, p50: 5000, p95: 7300, max: 7300 });
    assert.equal(r.tecnico.duracionConversacionSeg.p50, 120);
  }],
  ["Karla: la fila de auditoría enmascara y resume", () => {
    const [fila] = calcularResumen(soloKarla, HOY).auditoria;
    assert.equal(fila.clienteEnmascarado, "K. M*****");
    assert.equal(fila.turnos, 5);
    assert.equal(fila.tokensEntrada, 6000);
    assert.deepEqual(fila.acuerdo, { escalon: 2, tipo: "mover_fecha", monto: 145, fechaAcordada: "2026-09-16" });
  }],

  // --- Varias con nulos ---------------------------------------------------------
  ["Varias: ningún NaN ni Infinity", () => {
    sinNumerosInvalidos(calcularResumen(variasConNulos, HOY));
  }],
  ["Varias: el cierre excluye abiertas, y lo escalado cuenta en el denominador", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.deepEqual(r.gestion.cierreConAcuerdo, { numerador: 2, denominador: 4, valor: 0.5 });
    assert.deepEqual(r.gestion.escalamientoHumano, { numerador: 1, denominador: 4, valor: 0.25 });
    assert.equal(r.gestion.conversaciones.porEstado.abierta, 1);
  }],
  ["Varias: la cuota de Karla cuenta una sola vez aunque haya dos ensayos", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.deepEqual(r.gestion.cuotasProtegidas, { montoUsd: 145, clientes: 1 });
    cerca(r.provisiones.reservaEvitadaUsd, 12.4);
  }],
  ["Varias: un acuerdo sin monto se informa, no se suma como 0 silencioso", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.deepEqual(r.gestion.montoComprometido, { montoUsd: 145, acuerdosConMonto: 1, acuerdosSinMonto: 1 });
  }],
  ["Varias: turnos sin tokens y sin precio quedan contados aparte", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.equal(r.tecnico.tokens.turnosSinTokens, 1);
    assert.equal(r.tecnico.costo.turnosSinTokens, 1);
    assert.equal(r.tecnico.costo.turnosSinPrecio, 1);
    assert.equal(r.tecnico.costo.turnosCosteados, 2);
    assert.equal(r.tecnico.latenciaAgenteMs.n, 3);
  }],
  ["Varias: intervención del validador y sus motivos", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.deepEqual(r.tecnico.validador.intervencion, { numerador: 1, denominador: 4, valor: 0.25 });
    assert.deepEqual(r.tecnico.validador.motivos, [{ clave: "monto_inventado", cantidad: 1 }]);
  }],
  ["Varias: la duración ignora la conversación abierta", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.equal(r.tecnico.duracionConversacionSeg.n, 4);
    assert.equal(r.tecnico.duracionConversacionSeg.max, 360);
  }],
  ["Varias: motivos de no-acuerdo, rotación de modelos y escalones", () => {
    const r = calcularResumen(variasConNulos, HOY);
    assert.deepEqual(r.gestion.motivosNoAcuerdo, [{ clave: "No puede comprometer fecha", cantidad: 1 }]);
    assert.deepEqual(r.tecnico.modelos, [
      { clave: "gemini-3.6-flash", cantidad: 3 },
      { clave: "modelo-sin-precio", cantidad: 1 },
    ]);
    assert.equal(r.gestion.acuerdosPorEscalon.find((e) => e.id === "pase_humano")?.cantidad, 1);
  }],
];

let fallos = 0;
for (const [nombre, prueba] of pruebas) {
  try {
    prueba();
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    fallos += 1;
    console.error(`  FALLA ${nombre}`);
    console.error(`        ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
}

console.log(`\n${pruebas.length - fallos}/${pruebas.length} verificaciones pasaron.`);
process.exit(fallos === 0 ? 0 : 1);
