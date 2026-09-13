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
import { construirContexto } from "../lib/agent/prompt";
import type { Cliente } from "../lib/agent/types";
import { validar } from "../lib/agent/validator";
import { senalSinRed } from "../lib/riesgo";
import { derivarFeatures } from "../lib/riesgo/features";
import { puntuarReglas } from "../lib/riesgo/reglas";
import { consultarModelo } from "../lib/riesgo/servicio";
import type { SenalRiesgo } from "../lib/riesgo/types";

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

/** Fuerza una banda concreta sobre una señal real, para probar cómo reacciona el resto. */
function conBanda(cliente: Cliente, banda: SenalRiesgo["banda"], score: number): SenalRiesgo {
  return { ...senalSinRed(cliente, HOY), banda, score };
}

// ---------------------------------------------------------------------------

const pruebas: Array<[string, () => void | Promise<void>]> = [
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

  // --- Señal de riesgo: composición ---------------------------------------
  ["La señal es el máximo de las vistas, no su promedio", () => {
    // Reglas altas (desalineación) y score de lote bajo: promediar la escondería.
    const desalineadoConScoreBajo: Cliente = { ...karla, riesgoScore: 10, riesgoBanda: "LOW" };
    const senal = senalSinRed(desalineadoConScoreBajo, HOY);
    assert.equal(senal.componenteReglas, 58);
    assert.equal(senal.componenteRegistro, 10);
    assert.equal(senal.score, 58);
    assert.equal(senal.fuente, "reglas");
  }],
  ["El score de lote se conserva aunque las reglas locales no vean nada", () => {
    // Sandra: calendario alineado y sin atraso. Lo que la hace interesante (liquidez
    // apretada) solo lo ve el proceso de lote. Si se descartara, nadie la contactaría.
    const sandra: Cliente = {
      ...base, slug: "sandra", producto: "Crédito personal", cuota: 210, saldo: 1680,
      diaPago: 20, riesgoScore: 56, riesgoBanda: "MODERATE_HIGH",
    };
    const senal = senalSinRed(sandra, HOY);
    assert.equal(senal.fuente, "score_registrado");
    assert.equal(senal.banda, "MODERATE_HIGH");
    assert.equal(diagnosticar(sandra, HOY, senal).motivo, "riesgo_alto");
  }],
  ["Karla: la señal sugiere empezar por mover la fecha (escalón 2)", () => {
    assert.equal(senalSinRed(karla, HOY).escalonSugerido, 2);
  }],
  ["Sin desalineación, el escalón sugerido es el más barato de todos", () => {
    assert.equal(senalSinRed(wilber, HOY).escalonSugerido, 1);
  }],

  // --- Señal de riesgo: qué NO puede hacer --------------------------------
  ["CONTROL — la señal viva tampoco hace que se contacte a Marta", () => {
    const senal = senalSinRed(marta, HOY);
    assert.equal(senal.banda, "LOW");
    assert.equal(diagnosticar(marta, HOY, senal).motivo, null);
    assert.equal(debeContactar(marta, HOY, senal), false);
  }],
  ["Una señal baja NO puede apagar un contacto que los datos duros justifican", () => {
    // El orden de los motivos importa: atraso y desalineación se evalúan antes.
    assert.equal(diagnosticar(wilber, HOY, conBanda(wilber, "LOW", 5)).motivo, "atraso");
    assert.equal(
      diagnosticar(karla, HOY, conBanda(karla, "LOW", 5)).motivo,
      "desalineacion_quincena",
    );
  }],
  ["Una señal alta NO puede inventar opciones fuera de la escalera", () => {
    const ids = opcionesValidasPara(marta, conBanda(marta, "CRITICAL", 90)).map((o) => o.id);
    // Sube el riesgo al máximo y aun así no aparece nada que no le aplique a Marta.
    assert.ok(!ids.includes("mover_fecha"));
    assert.ok(!ids.includes("debito_automatico"));
    assert.ok(ids.every((id) => typeof id === "string"));
  }],
  ["Solo una señal CRITICAL desbloquea la reestructura", () => {
    const conCritical = opcionesValidasPara(karla, conBanda(karla, "CRITICAL", 90));
    assert.ok(conCritical.map((o) => o.id).includes("reestructura"));
    const conAlta = opcionesValidasPara(karla, conBanda(karla, "MODERATE_HIGH", 62));
    assert.ok(!conAlta.map((o) => o.id).includes("reestructura"));
  }],

  // --- Señal de riesgo: no se filtra al prompt -----------------------------
  ["El contexto no contiene el puntaje, la banda ni jerga de riesgo", () => {
    const contexto = construirContexto(karla, "agente", HOY, senalSinRed(karla, HOY));
    for (const prohibido of ["MODERATE_HIGH", "CRITICAL", "scorer", "score", "banda", "62"]) {
      assert.ok(!contexto.includes(prohibido), `el contexto contiene "${prohibido}"`);
    }
  }],
  ["Al prompt solo llegan los factores escritos por nosotros, no los del modelo", () => {
    const senal: SenalRiesgo = {
      ...senalSinRed(karla, HOY),
      factores: [
        { origen: "reglas", factor: "La cuota vence antes de la quincena" },
        { origen: "modelo", factor: "Utilización de línea de crédito alta (+27%)" },
      ],
    };
    const contexto = construirContexto(karla, "agente", HOY, senal);
    assert.ok(contexto.includes("La cuota vence antes de la quincena"));
    assert.ok(!contexto.includes("Utilización de línea de crédito"));
  }],
  ["El motivo de riesgo preventivo no le da al agente una razón que inventar", () => {
    const preventivo: Cliente = { ...base, diaPago: 20, riesgoScore: 60, riesgoBanda: "MODERATE_HIGH" };
    const dx = diagnosticar(preventivo, HOY, senalSinRed(preventivo, HOY));
    assert.equal(dx.motivo, "riesgo_alto");
    assert.ok(!dx.detalle.toLowerCase().includes("score"));
    assert.ok(!dx.detalle.includes("MODERATE_HIGH"));
  }],

  // --- Adaptador de features ----------------------------------------------
  ["La desalineación estructural se traduce en atrasos del semestre", () => {
    // 12 fallos al año = 6 por semestre. Es el insight local hecho feature.
    assert.equal(derivarFeatures(karla, HOY).features.latePaymentsLast6m, 6);
    assert.equal(derivarFeatures(marta, HOY).features.latePaymentsLast6m, 0);
  }],
  ["Los días hasta el vencimiento se acotan al rango que acepta el servicio", () => {
    // ml/api.py declara daysUntilNextPayment entre 1 y 45: fuera de rango responde 422.
    const venceHoy: Cliente = { ...base, diaPago: 12 };
    const f = derivarFeatures(venceHoy, HOY).features;
    assert.equal(f.daysUntilNextPayment, 1);
    assert.ok(f.daysUntilNextPayment >= 1 && f.daysUntilNextPayment <= 45);
  }],
  ["Lo que no se puede observar se declara, no se inventa", () => {
    const { noObservadas } = derivarFeatures(karla, HOY);
    assert.ok(noObservadas.some((n) => n.startsWith("monthlyIncome")));
    assert.ok(noObservadas.some((n) => n.startsWith("savingsDropPct")));
  }],
  ["El débito automático baja el componente de reglas", () => {
    const sinDebito = puntuarReglas({ ...marta, tieneDebitoAutomatico: false }).score;
    assert.equal(puntuarReglas(marta).score, sinDebito - 14);
  }],

  // --- El texto del modelo nunca cruza ------------------------------------
  ["Del servicio de ML se toman los números y se descarta el texto", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          riskScore: 74,
          riskLevel: "MODERATE_HIGH",
          predictedArrearsClass: "A2",
          defaultProbability: 0.74,
          topRiskFactors: [{ factor: "Utilización alta", impact: "+27%" }],
          // Los dos textos que el servicio redacta y que violan los guardrails:
          // prometen algo que no existe y saltan al escalón más caro.
          suggestedSolution: "Readecuación preventiva inmediata vía app móvil.",
          empatheticMessage:
            "Hemos preparado una readecuación personalizada con menor cuota y mayor plazo.",
        },
        meta: { modelType: "LightGBM", usedRealModel: true },
      }),
    })) as unknown as typeof fetch;

    try {
      const salida = await consultarModelo(derivarFeatures(karla, HOY).features);
      assert.ok(salida !== null);
      assert.equal(salida.score, 74);
      assert.equal(salida.claseSSF, "A2");
      const serializada = JSON.stringify(salida);
      assert.ok(!serializada.includes("readecuación"));
      assert.ok(!serializada.includes("Readecuación"));
      assert.ok(!serializada.includes("app móvil"));
    } finally {
      globalThis.fetch = original;
    }
  }],
  ["Si el servicio no responde, la señal sigue saliendo", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    try {
      assert.equal(await consultarModelo(derivarFeatures(karla, HOY).features), null);
    } finally {
      globalThis.fetch = original;
    }
  }],

  // --- Canal ---------------------------------------------------------------
  ["La guía de voz solo aparece en el canal de voz", () => {
    const senal = senalSinRed(karla, HOY);
    assert.ok(!construirContexto(karla, "agente", HOY, senal, "texto").includes("POR TELÉFONO"));
    assert.ok(construirContexto(karla, "agente", HOY, senal, "voz").includes("POR TELÉFONO"));
  }],
  ["Las opciones válidas son idénticas en texto y en voz", () => {
    const senal = senalSinRed(karla, HOY);
    const enTexto = construirContexto(karla, "agente", HOY, senal, "texto");
    const enVoz = construirContexto(karla, "agente", HOY, senal, "voz");
    for (const opcion of opcionesValidasPara(karla, senal)) {
      assert.ok(enTexto.includes(opcion.id), `falta ${opcion.id} en texto`);
      assert.ok(enVoz.includes(opcion.id), `falta ${opcion.id} en voz`);
    }
  }],
];

// Envuelto en una función a propósito: hay pruebas asíncronas (las que sustituyen
// `fetch` para verificar el borde con el servicio de ML) y `tsx` compila este archivo
// a CommonJS, que no admite `await` de nivel superior.
async function correr(): Promise<void> {
  let fallos = 0;

  for (const [nombre, prueba] of pruebas) {
    try {
      await prueba();
      console.log(`  ok   ${nombre}`);
    } catch (e) {
      fallos += 1;
      console.error(`  FALLA ${nombre}`);
      console.error(`        ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    }
  }

  console.log(`\n${pruebas.length - fallos}/${pruebas.length} verificaciones pasaron.`);
  process.exit(fallos === 0 ? 0 : 1);
}

void correr();
