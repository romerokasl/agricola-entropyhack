import { diasHastaVencimiento, hayDesalineacionQuincena, hayDesalineacionRemesa } from "../agent/calendario";
import type { Cliente } from "../agent/types";
import type { TrazaFeatures } from "./types";

/**
 * Adaptador: un `Cliente` del dominio → las features que declara `ml/api.py`.
 *
 * Este archivo es la respuesta concreta a la pregunta del jurado *"¿de dónde salen los
 * datos?"*: el modelo se entrenó con Home Credit y el banco corre otro esquema, así que
 * **el único lugar que hay que cambiar para conectar datos reales es este**
 * (`docs/contexto/02-decisiones-y-plan.md`, Q&A).
 *
 * Regla de honestidad que se sigue acá: lo que el esquema de `clientes` no permite
 * observar NO se inventa. Se manda el valor neutro del servicio y se declara en
 * `noObservadas`, que después viaja en la señal y se puede mostrar en la consola
 * interna. Un número inventado que se ve igual que uno medido es peor que un hueco.
 */

/**
 * Cuántas cuotas de exposición equivalen a "línea llena", según el producto.
 *
 * En un producto revolvente el saldo ES uso de línea; en uno que amortiza, el saldo es
 * lo que falta por pagar y se compara contra un plazo más largo. Distinguirlos evita
 * que un crédito de vehículo recién desembolsado se lea como una tarjeta topada.
 */
const CUOTAS_LINEA_REVOLVENTE = 26;
const CUOTAS_LINEA_AMORTIZABLE = 36;

const PRODUCTOS_REVOLVENTES = ["tarjeta", "extrafinanciamiento", "sobregiro"];

/**
 * Una desalineación estructural de calendario hace fallar ~12 veces al año — o sea
 * 6 veces por semestre. Es el insight #1 de `CLAUDE.md` convertido en feature: el
 * modelo no puede deducirlo, pero sí puede usarlo.
 */
const FALLOS_POR_SEMESTRE_SI_DESALINEADO = 6;
const TOPE_ATRASOS_SEMESTRE = 12;

/** `ml/api.py` acota `daysUntilNextPayment` a [1, 45]; fuera de rango responde 422. */
const DIAS_VENCIMIENTO_MIN = 1;
const DIAS_VENCIMIENTO_MAX = 45;

function esRevolvente(producto: string): boolean {
  const plano = producto.toLowerCase();
  return PRODUCTOS_REVOLVENTES.some((p) => plano.includes(p));
}

const acotar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function derivarFeatures(cliente: Cliente, hoy: Date): TrazaFeatures {
  const cuotasLinea = esRevolvente(cliente.producto)
    ? CUOTAS_LINEA_REVOLVENTE
    : CUOTAS_LINEA_AMORTIZABLE;

  // Observado: exposición pendiente medida en cuotas y normalizada al plazo del
  // producto. Sale de `saldo` y `cuota`, que son datos duros de la obligación.
  const utilizacion = acotar(cliente.saldo / (cliente.cuota * cuotasLinea), 0, 1);

  // Derivado: atrasos del semestre. El atraso de hoy cuenta como uno; la
  // desalineación estructural suma los que ya ocurrieron y los que van a ocurrir.
  const desalineado = hayDesalineacionQuincena(cliente) || hayDesalineacionRemesa(cliente);
  const atrasosSemestre = Math.min(
    (cliente.diasAtraso > 0 ? 1 : 0) + (desalineado ? FALLOS_POR_SEMESTRE_SI_DESALINEADO : 0),
    TOPE_ATRASOS_SEMESTRE,
  );

  return {
    features: {
      customerId: cliente.slug,
      creditLineUtilization: Number(utilizacion.toFixed(4)),
      // Sin ingreso en el esquema no hay DTI real. Se manda el neutro documentado
      // del servicio en vez de fabricar un ingreso a partir de la cuota, que sería
      // circular (la cuota ya es el numerador).
      debtToIncomeRatio: 0.35,
      savingsDropPct: 0,
      latePaymentsLast6m: atrasosSemestre,
      daysUntilNextPayment: acotar(
        diasHastaVencimiento(cliente, hoy),
        DIAS_VENCIMIENTO_MIN,
        DIAS_VENCIMIENTO_MAX,
      ),
      recentPaymentDifference: 0,
    },
    noObservadas: [
      "monthlyIncome (el esquema de clientes no guarda ingreso)",
      "debtToIncomeRatio (se manda el neutro del servicio, no un DTI medido)",
      "savingsDropPct (no hay serie de ahorro conectada)",
      "recentPaymentDifference (no hay historial de pagos conectado)",
    ],
  };
}
