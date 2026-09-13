import { z } from "zod";

import { guardarAcuerdo, guardarNoAcuerdo } from "../db/conversaciones";
import { diagnosticar } from "./calendario";
import { ESCALERA, opcionesValidasPara } from "./ladder";
import type { DeclaracionTool } from "./llm";
import type { Cliente } from "./types";

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

const esquemaConsultarCliente = z.object({}).strict();

const esquemaConsultarOpciones = z.object({}).strict();

const esquemaRegistrarAcuerdo = z
  .object({
    tipo: z.string().min(1),
    diaAcordado: z.number().int().min(1).max(31),
    // `nullish`, no `optional`: medido con qwen2.5:3b, un modelo puede mandar
    // `monto: null` para decir "sin monto" en vez de omitir el campo. Con `optional`
    // eso es un error de parseo y el acuerdo no se registra — justo en el turno de
    // cierre, que es el momento que más importa del demo.
    monto: z
      .number()
      .positive()
      .nullish()
      .transform((v) => v ?? undefined),
  })
  .strict();

const esquemaRegistrarNoAcuerdo = z
  .object({ motivo: z.string().min(3) })
  .strict();

export const DECLARACIONES: readonly DeclaracionTool[] = [
  {
    nombre: "consultarCliente",
    descripcion:
      "Devuelve los datos verificados de la persona con la que estás hablando: cuota, saldo, día de vencimiento, días de atraso y cuándo cobra. Usala cuando necesités confirmar un dato antes de decirlo.",
    parametros: { type: "object", properties: {} },
  },
  {
    nombre: "consultarOpcionesValidas",
    descripcion:
      "Devuelve la lista de opciones que le podés ofrecer a esta persona, de menor a mayor costo para el banco. Nada fuera de esta lista existe.",
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
      "Registra que la conversación terminó sin acuerdo, explicando en una frase cuál es el siguiente paso y por qué. Una conversación que no cierra en nada igual tiene que quedar registrada.",
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
}

export interface ResultadoTool {
  nombre: string;
  /** Payload que se le devuelve al modelo. */
  salida: Record<string, unknown>;
  /** true cuando el acuerdo (o no-acuerdo) quedó registrado y la conversación cerró. */
  cerroConversacion: boolean;
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

const errorTool = (nombre: string, mensaje: string): ResultadoTool => ({
  nombre,
  salida: { error: mensaje },
  cerroConversacion: false,
});

export async function ejecutarTool(
  nombre: string,
  argumentos: Record<string, unknown>,
  ctx: ContextoTools,
): Promise<ResultadoTool> {
  const { cliente, conversacionId, hoy } = ctx;

  if (nombre === "consultarCliente") {
    if (!esquemaConsultarCliente.safeParse(argumentos).success) {
      return errorTool(nombre, "Esta herramienta no recibe parámetros.");
    }
    const dx = diagnosticar(cliente, hoy);
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
        opciones: opcionesValidasPara(cliente).map((o) => ({
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
      return errorTool(nombre, `Parámetros inválidos: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const { tipo, diaAcordado, monto } = parsed.data;

    const opcion = opcionesValidasPara(cliente).find((o) => o.id === tipo);
    if (!opcion) {
      const disponibles = opcionesValidasPara(cliente).map((o) => o.id).join(", ");
      return errorTool(
        nombre,
        `"${tipo}" no es una opción disponible para esta persona. Las disponibles son: ${disponibles}.`,
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
    };
  }

  if (nombre === "registrarNoAcuerdo") {
    const parsed = esquemaRegistrarNoAcuerdo.safeParse(argumentos);
    if (!parsed.success) {
      return errorTool(nombre, "Hace falta un motivo de al menos 3 caracteres.");
    }
    await guardarNoAcuerdo({ conversacionId, motivo: parsed.data.motivo });
    return { nombre, salida: { registrado: true }, cerroConversacion: true };
  }

  return errorTool(nombre, `La herramienta "${nombre}" no existe.`);
}
