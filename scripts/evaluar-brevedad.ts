/**
 * Mide si los ejemplos en el prompt arreglan el problema de brevedad de los modelos
 * chicos.
 *
 * Por qué existe: medido contra la base, el único motivo de rechazo del validador en los
 * tres modelos probados es `demasiadas_frases`. Los guardrails duros aguantan; lo que
 * falla es el largo. `EJEMPLOS_BREVEDAD` es el intento de arreglarlo mostrando en vez de
 * pedir, y esto comprueba si sirve o no.
 *
 * Corre el MISMO turno N veces con ejemplos y N veces sin ellos, contra el proveedor que
 * esté configurado, y compara cuántas respuestas pasa el validador.
 *
 * Limitación a tener presente: no ejecuta el ciclo de herramientas, porque eso exigiría
 * base de datos. Aísla la generación de texto, que es justo lo que se quiere medir.
 *
 * Uso:  npx tsx scripts/evaluar-brevedad.ts [repeticiones]
 */

import { obtenerLlmProvider } from "../lib/agent/llm";
import { construirContexto, EJEMPLOS_BREVEDAD, SYSTEM_PROMPT } from "../lib/agent/prompt";
import type { Cliente } from "../lib/agent/types";
import { validar } from "../lib/agent/validator";
import { senalSinRed } from "../lib/riesgo";

const HOY = new Date(2026, 8, 13);
const REPETICIONES = Number(process.argv[2] ?? 5);

const karla: Cliente = {
  id: "00000000-0000-0000-0000-000000000001",
  slug: "karla",
  nombre: "Karla Menjívar",
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

/** El turno que más largo sale: la persona explica su problema y espera una salida. */
const MENSAJE = "fíjese que para el 8 ya ando sin pisto, hasta el 15 me cae la quincena";

function contarFrases(texto: string): number {
  return texto.split(/[.!?]+(?=\s|$)/).filter((f) => f.trim().length > 0).length;
}

interface Resultado {
  ok: number;
  motivos: Record<string, number>;
  frases: number[];
}

async function correrTanda(conEjemplos: boolean): Promise<Resultado> {
  const proveedor = obtenerLlmProvider();
  const senal = senalSinRed(karla, HOY);
  const base = construirContexto(karla, "agente", HOY, senal, "voz");
  const contexto = conEjemplos ? `${base}\n${EJEMPLOS_BREVEDAD}` : base;

  const salida: Resultado = { ok: 0, motivos: {}, frases: [] };

  for (let i = 0; i < REPETICIONES; i += 1) {
    const respuesta = await proveedor.generar({
      systemPrompt: SYSTEM_PROMPT,
      contexto,
      historial: [{ rol: "cliente", texto: MENSAJE }],
      tools: [],
    });

    const veredicto = validar(respuesta.texto, {
      cliente: karla,
      historial: [{ rol: "cliente", texto: MENSAJE }],
      esPrimerMensajeDelAgente: true,
      senal,
    });

    salida.frases.push(contarFrases(respuesta.texto));
    if (veredicto.ok) salida.ok += 1;
    else salida.motivos[veredicto.motivo ?? "?"] = (salida.motivos[veredicto.motivo ?? "?"] ?? 0) + 1;

    process.stdout.write(veredicto.ok ? "." : "x");
  }

  process.stdout.write("\n");
  return salida;
}

function resumir(nombre: string, r: Resultado): void {
  const promedio = r.frases.reduce((a, b) => a + b, 0) / r.frases.length;
  const motivos = Object.entries(r.motivos)
    .map(([m, n]) => `${m}×${n}`)
    .join(", ");
  console.log(
    `  ${nombre.padEnd(16)} pasa ${r.ok}/${REPETICIONES}  ·  frases ${promedio.toFixed(1)} de promedio` +
      (motivos ? `  ·  ${motivos}` : ""),
  );
}

async function main(): Promise<void> {
  const proveedor = obtenerLlmProvider();
  console.log(`Modelo: ${proveedor.nombre}/${proveedor.modeloVersion} · ${REPETICIONES} repeticiones\n`);

  console.log("SIN ejemplos:");
  const sin = await correrTanda(false);

  console.log("CON ejemplos:");
  const con = await correrTanda(true);

  console.log("");
  resumir("sin ejemplos", sin);
  resumir("con ejemplos", con);
}

void main();
