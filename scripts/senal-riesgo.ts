/**
 * Imprime la señal de riesgo de los 8 personajes del pitch, con sus tres vistas
 * desglosadas y la decisión de contacto que produce cada una.
 *
 * Para qué sirve:
 *  - Ver de un vistazo si el microservicio de `ml/` está aportando o no (columna
 *    `vivo`), sin abrir Swagger ni una conversación.
 *  - Confirmar antes del demo que el caso de control (Marta) sigue sin ser contactado
 *    y que el caso estrella (Karla) sigue sugiriendo el escalón 2.
 *  - Enseñarlo en el pitch: es la evidencia de que el modelo y las reglas locales son
 *    dos vistas distintas y de que la decisión sale de combinarlas.
 *
 * Uso:  npm run riesgo:demo
 *
 * No toca la base de datos: lee el dataset determinista de `scripts/dataset.mjs`.
 * Si el servicio de Python no está levantado, la columna `vivo` sale vacía y el resto
 * funciona igual — que es justo lo que hay que poder demostrar.
 */

import { diagnosticar } from "../lib/agent/calendario";
import type { Cliente } from "../lib/agent/types";
import { obtenerSenalRiesgo, urlServicioMl } from "../lib/riesgo";
import { PERSONAJES } from "./dataset.mjs";

interface FilaSemilla {
  slug: string;
  nombre: string;
  edad: number;
  distrito: string;
  segmento: string;
  tipo_ingreso: Cliente["tipoIngreso"];
  dia_ingreso_1: number;
  dia_ingreso_2: number | null;
  dia_remesa: number | null;
  producto: string;
  cuota: string;
  saldo: string;
  dia_pago: number;
  dias_atraso: number;
  tiene_debito_automatico: boolean;
  riesgo_score: number;
  riesgo_banda: Cliente["riesgoBanda"];
}

function aCliente(fila: FilaSemilla): Cliente {
  return {
    id: `demo-${fila.slug}`,
    slug: fila.slug,
    nombre: fila.nombre,
    edad: fila.edad,
    distrito: fila.distrito,
    segmento: fila.segmento,
    tipoIngreso: fila.tipo_ingreso,
    diaIngreso1: fila.dia_ingreso_1,
    diaIngreso2: fila.dia_ingreso_2,
    diaRemesa: fila.dia_remesa,
    producto: fila.producto,
    cuota: Number(fila.cuota),
    saldo: Number(fila.saldo),
    diaPago: fila.dia_pago,
    diasAtraso: fila.dias_atraso,
    tieneDebitoAutomatico: fila.tiene_debito_automatico,
    riesgoScore: fila.riesgo_score,
    riesgoBanda: fila.riesgo_banda,
  };
}

const col = (v: unknown, ancho: number) => String(v ?? "—").padStart(ancho);

async function main(): Promise<void> {
  const hoy = new Date();
  console.log(`Servicio de ML: ${urlServicioMl()}`);
  console.log(`Fecha de referencia: ${hoy.toISOString().slice(0, 10)}\n`);
  console.log("persona   vivo  lote regla  final  banda          fuente             esc  motivo de contacto");
  console.log("-".repeat(110));

  let contactados = 0;

  for (const fila of PERSONAJES as unknown as FilaSemilla[]) {
    const cliente = aCliente(fila);
    const senal = await obtenerSenalRiesgo(cliente, hoy);
    const motivo = diagnosticar(cliente, hoy, senal).motivo;
    if (motivo !== null) contactados += 1;

    console.log(
      `${fila.slug.padEnd(9)} ${col(senal.componenteModeloVivo, 4)}  ${col(senal.componenteRegistro, 4)}  ${col(senal.componenteReglas, 4)}` +
        `   ${col(senal.score, 4)}  ${senal.banda.padEnd(14)} ${senal.fuente.padEnd(18)} ${col(senal.escalonSugerido, 3)}  ${motivo ?? "— (no se contacta)"}`,
    );
  }

  console.log(
    `\n${contactados}/${(PERSONAJES as unknown[]).length} personas entran al conjunto de contacto.`,
  );
  console.log(
    "Columnas: vivo = microservicio de ml/ · lote = clientes.riesgo_score · regla = calendario local.\n" +
      "La señal final es el máximo de las tres; 'fuente' dice cuál la produjo.",
  );
}

void main();
