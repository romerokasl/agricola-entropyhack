/**
 * Verificación de la lógica pura del agente: calendario, escalera y validador.
 *
 * No toca red, ni base de datos, ni el LLM. Corre en segundos y cubre justo lo que
 * más caro sale que esté mal: que el caso estrella (Karla) detecte la desalineación,
 * que el caso de control (Marta) NO dispare contacto, y que el validador bloquee lo
 * que el jurado va a intentar.
 *
 * Uso:  npm run verify:reglas
 *
 * Se ejecuta con `npx tsx` a propósito: los módulos usan imports sin extensión (los
 * necesita Next) y Node no los resuelve solo. Así se evita agregar un framework de
 * tests al lockfile compartido a mitad del hackatón.
 */

import assert from "node:assert/strict";

import {
  debeContactar,
  diagnosticar,
  diasHastaReporteBuro,
  fechaSugeridaAlineada,
} from "../lib/agent/calendario";
import { esPlazoValido, opcionesValidasPara } from "../lib/agent/ladder";
import type { Cliente } from "../lib/agent/types";
import { validar } from "../lib/agent/validator";

/** Fecha fija: si dependiera de "hoy", la verificación fallaría según el día. */
const HOY = new Date(2026, 8, 12); // 12 de septiembre de 2026

const base: Cliente = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "fixture",
  nombre: "Fixture",
  edad: 30,
  distrito: "San Salvador",
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
};

const karla: Cliente = { ...base, slug: "karla", nombre: "Karla Menjívar" };

const jose: Cliente = {
  ...base, slug: "jose", nombre: "José Portillo", segmento: "Remesas",
  tipoIngreso: "mensual", diaIngreso1: 5, diaIngreso2: null, diaRemesa: 5,
  producto: "Crédito personal", cuota: 98.5, saldo: 2150, diaPago: 3,
};

const wilber: Cliente = { ...base, slug: "wilber", nombre: "Wilber Alvarenga", diaPago: 15, diasAtraso: 6 };

const marta: Cliente = {
  ...base, slug: "marta", nombre: "Marta Cruz", producto: "Crédito de vehículo",
  cuota: 320, saldo: 5400, diaPago: 20, tieneDebitoAutomatico: true,
  riesgoScore: 8, riesgoBanda: "LOW",
};

const critico: Cliente = { ...base, slug: "critico", diasAtraso: 22, riesgoBanda: "CRITICAL" };

// ---------------------------------------------------------------------------

const pruebas: Array<[string, () => void]> = [
  // --- Calendario ---------------------------------------------------------
  ["Karla: se detecta la desalineación de quincena", () => {
    assert.equal(diagnosticar(karla, HOY).motivo, "desalineacion_quincena");
  }],
  ["Karla: la fecha sugerida es el 16 (el día después de la quincena)", () => {
    assert.equal(fechaSugeridaAlineada(karla), 16);
  }],
  ["José: se detecta el desfase de la remesa", () => {
    assert.equal(diagnosticar(jose, HOY).motivo, "desalineacion_remesa");
  }],
  ["José: la fecha sugerida cae después de que entra la remesa", () => {
    assert.equal(fechaSugeridaAlineada(jose), 6);
  }],
  ["Wilber: el atraso tiene prioridad sobre cualquier otro motivo", () => {
    assert.equal(diagnosticar(wilber, HOY).motivo, "atraso");
  }],
  ["CONTROL — Marta no dispara ningún motivo de contacto", () => {
    assert.equal(diagnosticar(marta, HOY).motivo, null);
    assert.equal(debeContactar(marta, HOY), false);
  }],
  ["La ventana del buró se cuenta hasta el día 10", () => {
    assert.equal(diasHastaReporteBuro(new Date(2026, 8, 3)), 7);
    assert.equal(diasHastaReporteBuro(new Date(2026, 8, 12)), 28);
  }],

  // --- Escalera -----------------------------------------------------------
  ["Karla: mover la fecha está disponible y la reestructura no", () => {
    const ids = opcionesValidasPara(karla).map((o) => o.id);
    assert.ok(ids.includes("mover_fecha"));
    assert.ok(!ids.includes("reestructura"));
  }],
  ["Marta: no se le ofrece débito automático porque ya lo tiene", () => {
    const ids = opcionesValidasPara(marta).map((o) => o.id);
    assert.ok(!ids.includes("debito_automatico"));
    assert.ok(!ids.includes("mover_fecha"));
    assert.ok(!ids.includes("reestructura"));
  }],
  ["Wilber: 6 días de atraso NO habilitan una reestructura", () => {
    assert.ok(!opcionesValidasPara(wilber).map((o) => o.id).includes("reestructura"));
  }],
  ["Solo el estrés sostenido habilita la reestructura", () => {
    assert.ok(opcionesValidasPara(critico).map((o) => o.id).includes("reestructura"));
  }],
  ["El pase a humano siempre está disponible", () => {
    for (const c of [karla, jose, wilber, marta, critico]) {
      assert.ok(opcionesValidasPara(c).map((o) => o.id).includes("pase_humano"), c.slug);
    }
  }],
  ["Los plazos se aceptan solo hasta 3 días después del vencimiento", () => {
    assert.equal(esPlazoValido(0), true);
    assert.equal(esPlazoValido(3), true);
    assert.equal(esPlazoValido(4), false);
    assert.equal(esPlazoValido(-1), false);
  }],

  // --- Validador ----------------------------------------------------------
  ["Se acepta un primer mensaje correcto", () => {
    const r = validar(
      "Karla, soy el asistente de Bancoagrícola y te escribo por tu cuota de este mes. ¿Te queda cómodo pagar ese día?",
      { cliente: karla, historial: [], esPrimerMensajeDelAgente: true },
    );
    assert.equal(r.ok, true, r.motivo ?? "");
  }],
  ["El primer mensaje sin presentación se bloquea", () => {
    const r = validar("Hola Karla, ¿cómo estás?", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: true,
    });
    assert.equal(r.motivo, "falta_presentacion");
  }],
  ["Se bloquea la jerga prohibida", () => {
    const r = validar("Estás moroso desde hace días.", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.motivo, "palabra_prohibida");
  }],
  ["Se bloquea mencionar otro banco", () => {
    const r = validar("Podés pagarlo con el Cuscatlán.", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.motivo, "otro_banco");
  }],
  ["Se bloquea un monto que no sale del contexto", () => {
    const r = validar("Tu cuota es de $999.00 este mes.", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.motivo, "monto_inventado");
  }],
  ["Se aceptan la cuota, el saldo y la mitad de la cuota", () => {
    for (const texto of ["Tu cuota es de $145.00.", "Tu saldo es $1,240.00.", "Serían dos pagos de $72.50."]) {
      const r = validar(texto, { cliente: karla, historial: [], esPrimerMensajeDelAgente: false });
      assert.equal(r.ok, true, `${texto} → ${r.motivo}`);
    }
  }],
  ["Se acepta un monto que la propia persona mencionó", () => {
    const r = validar("Con $170.00 evitás que se te dañe el récord.", {
      cliente: karla,
      historial: [{ rol: "cliente", texto: "solo tengo $170 ahorita" }],
      esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.ok, true, r.motivo ?? "");
  }],
  ["Se bloquea una respuesta de más de 3 frases", () => {
    const r = validar("Uno. Dos. Tres. Cuatro.", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.motivo, "demasiadas_frases");
  }],
  ["Los decimales de un monto NO cuentan como fin de frase", () => {
    // Regresión: "$145.00" hacía que el conteo diera 4 y el cierre se rechazaba
    // casi siempre, porque el mensaje de cierre siempre menciona el monto.
    const r = validar("Listo, Karla. Te dejé la fecha para el 16. Vas a pagar $145.00 cada mes.", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.ok, true, r.motivo ?? "");
  }],
  ["Se bloquea el exceso de exclamaciones", () => {
    const r = validar("Qué bueno! Excelente!", {
      cliente: karla, historial: [], esPrimerMensajeDelAgente: false,
    });
    assert.equal(r.motivo, "demasiadas_exclamaciones");
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
