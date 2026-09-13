import { z } from "zod";

import { guardarAcuerdo, guardarNoAcuerdo } from "../db/conversaciones";
import type { SenalRiesgo } from "../riesgo/types";
import { diagnosticar } from "./calendario";
import { ESCALERA, opcionesValidasPara } from "./ladder";
import type { DeclaracionTool } from "./llm";
import type { Cliente, TipoCierre, Turno } from "./types";

/**
 * Tools tipadas. El modelo razona la conversación; los datos y las reglas vienen de
 * fuentes estructuradas verificadas. Sin RAG ni búsqueda semántica: los datos
 * financieros son deterministas y una aproximación probabilística sobre un saldo es
 * inaceptable (docs/contexto/02-decisiones-y-plan.md §1).
 *
 * Principio de diseño: el modelo manda lo MÍNIMO y el código deriva el resto. No manda
 * el número de escalón (se deriva del tipo) ni una fecha completa (manda un día del mes
 * y el código calcula la fecha). Así no puede inventar ninguno de los dos.
 */

const esquemaConsultarCliente = z.any();

const esquemaConsultarOpciones = z.any();

/**
 * Los modelos chicos mandan los números como texto. Medido con llama3.1 en un ensayo:
 * `registrarAcuerdo` recibió `{"monto":"145","diaAcordado":"16"}` y Zod lo rechazó
 * entero — justo en el turno de cierre, que es el momento que más importa del demo.
 *
 * Convertir es seguro: las validaciones de rango corren después de esto, así que un
 * "abc" o un día 47 se siguen rechazando igual.
 */
const aNumero = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);

const esquemaRegistrarAcuerdo = z
  .object({
    tipo: z.string().min(1),
    diaAcordado: z.preprocess(aNumero, z.number().int().min(1).max(31)),
    // `nullish`, no `optional`: medido con qwen2.5:3b, un modelo puede mandar
    // `monto: null` para decir "sin monto" en vez de omitir el campo. Con `optional`
    // eso es un error de parseo y el acuerdo no se registra.
    monto: z.preprocess(
      aNumero,
      z
        .number()
        .positive()
        .nullish()
        .transform((v) => v ?? undefined),
    ),
  })
  .strict();

const esquemaRegistrarNoAcuerdo = z
  .object({ motivo: z.string().min(3) })
  .strict();

export const DECLARACIONES: readonly DeclaracionTool[] = [
  {
    nombre: "consultarCliente",
    descripcion:
      "Opcional: consulta datos del cliente. Nota: los datos ya están en el contexto inicial, no la invoques para responder preguntas conversacionales básicas.",
    parametros: { type: "object", properties: {} },
  },
  {
    nombre: "consultarOpcionesValidas",
    descripcion:
      "Opcional: consulta las opciones válidas. Nota: las opciones ya están en el contexto inicial, no la invoques para responder preguntas conversacionales básicas.",
    parametros: { type: "object", properties: {} },
  },
  {
    nombre: "registrarAcuerdo",
    descripcion:
      "Registra el acuerdo cuando la persona lo confirmó explícitamente. 'tipo' es el identificador de la opción acordada (por ejemplo mover_fecha o abono_parcial). 'diaAcordado' es el día del mes acordado. 'monto' solo si se acordó un monto distinto a la cuota completa.",
    parametros: {
      type: "object",
      properties: {
        tipo: { type: "string", description: "Identificador de la opción, tal como aparece en las opciones válidas." },
        diaAcordado: { type: "integer", description: "Día del mes acordado para el pago (1 a 31)." },
        monto: { type: "number", description: "Monto acordado en dólares, si es distinto a la cuota completa." },
      },
      required: ["tipo", "diaAcordado"],
    },
  },
  {
    nombre: "registrarNoAcuerdo",
    descripcion:
      "Registra que la conversación terminó definitivamente sin acuerdo únicamente cuando la persona cuelga, se rehúsa rotundamente a hablar o pide terminar la llamada. NUNCA la invoques si la persona sigue en la llamada haciendo preguntas, dudas o proponiendo fechas.",
    parametros: {
      type: "object",
      properties: { motivo: { type: "string", description: "Por qué no hubo acuerdo y cuál es el siguiente paso." } },
      required: ["motivo"],
    },
  },
] as const;

export interface ContextoTools {
  cliente: Cliente;
  conversacionId: string;
  hoy: Date;
  /**
   * La señal de riesgo del turno. Va acá para que la lista de opciones que ve el
   * modelo y la que valida el registro del acuerdo sean LA MISMA. Si difirieran, el
   * agente podría ofrecer algo que después el registro rechaza — y eso pasaría justo
   * en el turno de cierre.
   */
  senal?: SenalRiesgo | null;
  historial?: readonly Turno[];
}

export interface ResultadoTool {
  nombre: string;
  /** Payload que se le devuelve al modelo. */
  salida: Record<string, unknown>;
  /** true cuando el acuerdo (o no-acuerdo) quedó registrado y la conversación cerró. */
  cerroConversacion: boolean;
  tipoCierre?: TipoCierre | null;
}

/** Convierte un día del mes en una fecha real, saltando al mes siguiente si ya pasó. */
function fechaDesdeDia(dia: number, hoy: Date): string {
  const candidata = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
  if (candidata < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
    candidata.setMonth(candidata.getMonth() + 1);
  }
  const y = candidata.getFullYear();
  const m = String(candidata.getMonth() + 1).padStart(2, "0");
  const d = String(candidata.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Un error de herramienta vuelve al modelo como dato para que se corrija, pero sin
 * dejar rastro no se puede saber que pasó: en un ensayo el agente dijo "hubo un error al
 * registrar el acuerdo" y no había forma de reconstruir con qué argumentos falló.
 */
const errorTool = (nombre: string, mensaje: string, argumentos?: unknown): ResultadoTool => {
  console.error(
    `[tool] ${nombre} rechazó los argumentos: ${mensaje} · recibido: ${JSON.stringify(argumentos)}`,
  );
  return {
    nombre,
    salida: {
      error: mensaje,
      // Sin esta instrucción el modelo narra la falla: en un ensayo el agente le dijo a
      // la persona "hubo un error al registrar el acuerdo". Un problema interno nuestro
      // no es asunto suyo, y nombrarlo destruye la confianza justo al cerrar.
      instruccion:
        "Esto es un problema interno. NO se lo menciones a la persona ni le pidas disculpas por él. Corregí los argumentos y volvé a llamar la herramienta.",
    },
    cerroConversacion: false,
  };
};

export async function ejecutarTool(
  nombre: string,
  argumentos: Record<string, unknown> = {},
  ctx: ContextoTools,
): Promise<ResultadoTool> {
  const { cliente, conversacionId, hoy, senal } = ctx;
  const safeArgs = argumentos ?? {};

  if (nombre === "consultarCliente") {
    if (!esquemaConsultarCliente.safeParse(safeArgs).success) {
      return errorTool(nombre, "Esta herramienta no recibe parámetros.");
    }
    const dx = diagnosticar(cliente, hoy, senal);
    return {
      nombre,
      salida: {
        nombre: cliente.nombre,
        producto: cliente.producto,
        cuota: cliente.cuota,
        saldo: cliente.saldo,
        diaPago: cliente.diaPago,
        diasAtraso: cliente.diasAtraso,
        tipoIngreso: cliente.tipoIngreso,
        diasCobro: [cliente.diaIngreso1, cliente.diaIngreso2].filter((d) => d !== null),
        diaRemesa: cliente.diaRemesa,
        tieneDebitoAutomatico: cliente.tieneDebitoAutomatico,
        diasHastaVencimiento: dx.diasHastaVencimiento,
        diasHastaReporteBuro: dx.diasHastaReporteBuro,
      },
      cerroConversacion: false,
    };
  }

  if (nombre === "consultarOpcionesValidas") {
    if (!esquemaConsultarOpciones.safeParse(argumentos).success) {
      return errorTool(nombre, "Esta herramienta no recibe parámetros.");
    }
    return {
      nombre,
      salida: {
        opciones: opcionesValidasPara(cliente, senal).map((o) => ({
          escalon: o.escalon,
          tipo: o.id,
          titulo: o.titulo,
          detalle: o.detalle,
          cuando: o.cuando,
        })),
        regla: "Ofrecé el escalón de número más bajo que resuelva el caso.",
      },
      cerroConversacion: false,
    };
  }

  if (nombre === "registrarAcuerdo") {
    const parsed = esquemaRegistrarAcuerdo.safeParse(argumentos);
    if (!parsed.success) {
      return errorTool(nombre, `Parámetros inválidos: ${parsed.error.issues.map((i) => i.message).join("; ")}`, argumentos);
    }
    const { tipo, diaAcordado, monto } = parsed.data;

    const opcion = opcionesValidasPara(cliente, senal).find((o) => o.id === tipo);
    if (!opcion) {
      const disponibles = opcionesValidasPara(cliente, senal).map((o) => o.id).join(", ");
      return errorTool(
        nombre,
        `"${tipo}" no es una opción disponible para esta persona. Las disponibles son: ${disponibles}.`,
        argumentos,
      );
    }

    // El escalón se deriva del tipo: el modelo no lo manda, así que no puede equivocarlo.
    const escalon = ESCALERA.find((e) => e.id === opcion.id)?.escalon;
    if (escalon === undefined) return errorTool(nombre, `Escalón no resoluble para "${tipo}".`);

    let montoFinal = monto ?? cliente.cuota;
    if (opcion.id === "abono_parcial") {
      if (monto === undefined) {
        return errorTool(nombre, "Un abono parcial necesita un monto explícito. Preguntale cuánto puede abonar.");
      }
      if (monto > cliente.cuota) {
        return errorTool(nombre, `El abono ($${monto.toFixed(2)}) no puede superar la cuota ($${cliente.cuota.toFixed(2)}).`);
      }
    } else if (monto !== undefined && monto > cliente.cuota) {
      return errorTool(nombre, `El monto ($${monto.toFixed(2)}) no puede superar la cuota ($${cliente.cuota.toFixed(2)}).`);
    }
    if (opcion.id === "dividir_cuota") montoFinal = cliente.cuota / 2;

    const fechaAcordada = fechaDesdeDia(diaAcordado, hoy);
    await guardarAcuerdo({
      conversacionId,
      escalon,
      tipo: opcion.id,
      monto: Number(montoFinal.toFixed(2)),
      fechaAcordada,
    });

    return {
      nombre,
      salida: {
        registrado: true,
        escalon,
        tipo: opcion.id,
        monto: Number(montoFinal.toFixed(2)),
        fechaAcordada,
      },
      cerroConversacion: true,
      tipoCierre: "acuerdo",
    };
  }

  if (nombre === "registrarNoAcuerdo") {
    const parsed = esquemaRegistrarNoAcuerdo.safeParse(safeArgs);
    if (!parsed.success) {
      return errorTool(nombre, "Hace falta un motivo de al menos 3 caracteres.");
    }

    const ultimoCliente = [...(ctx.historial ?? [])].reverse().find((t) => t.rol === "cliente");
    const textoCliente = ultimoCliente?.texto.toLowerCase() ?? "";
    const esPreguntaODuda = /\?|con c|con k|opci[oó]n|cu[aá]nto|c[oó]mo|qui[eé]n|puedo|plazo|a[ñn]o/i.test(textoCliente);
    const esRechazoExplicito = /\b(?:no voy a pagar|no quiero pagar|no me llamen|dejen de molestar|no me interesa|cuelgo|voy a colgar|no tengo tiempo|adios|chao)\b/i.test(textoCliente);

    if (esPreguntaODuda && !esRechazoExplicito) {
      return errorTool(
        nombre,
        "La persona está haciendo una pregunta o explorando opciones, NO ha rechazado el contacto. Respondé su pregunta directamente con amabilidad y continuá la llamada sin cerrar.",
      );
    }

    await guardarNoAcuerdo({ conversacionId, motivo: parsed.data.motivo });
    return { nombre, salida: { registrado: true }, cerroConversacion: true, tipoCierre: "no_acuerdo" };
  }

  return errorTool(nombre, `La herramienta "${nombre}" no existe.`);
}
