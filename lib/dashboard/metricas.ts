import { diagnosticar } from "../agent/calendario";
import { ESCALERA } from "../agent/ladder";
import type { BandaRiesgo, Cliente, EstadoConversacion, MotivoContacto } from "../agent/types";
import { reservaEvitadaUsd, SUPUESTO_PROVISIONES } from "./ncb022";
import { precioDe, PRECIOS_FUENTE, PRECIOS_VIGENTES_AL } from "./precios";
import type {
  AcuerdoFila,
  Conteo,
  ConversacionFila,
  CostoEstimado,
  DatosDashboard,
  Distribucion,
  FilaAuditoria,
  MetricasCartera,
  MetricasGestion,
  MetricasTecnicas,
  ProvisionesEvitadas,
  ResumenDashboard,
  Tasa,
  TurnoMetricasFila,
} from "./types";

/**
 * Cálculo del dashboard. Funciones puras: reciben filas, devuelven métricas.
 *
 * Sin I/O a propósito, para verificarlas con fixtures sin red ni base
 * (scripts/verificar-dashboard.ts). Ningún número de acá sale de una constante que
 * aparente ser medida: o viene de las filas, o de una tabla con fuente citada.
 */

const ESTADOS_CERRADOS: ReadonlySet<EstadoConversacion> = new Set([
  "cerrada_con_acuerdo",
  "cerrada_sin_acuerdo",
  "escalada_humano",
]);

// --- Primitivas ------------------------------------------------------------------

export function tasa(numerador: number, denominador: number): Tasa {
  return { numerador, denominador, valor: denominador > 0 ? numerador / denominador : null };
}

/**
 * Percentil por nearest-rank: siempre devuelve un valor observado, nunca uno
 * interpolado. Con pocas conversaciones es lo más honesto — un p95 interpolado entre
 * dos turnos es un número que no ocurrió.
 */
export function percentil(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const rango = Math.ceil((p / 100) * orden.length);
  return orden[Math.min(Math.max(rango, 1), orden.length) - 1];
}

export function distribucion(valores: readonly number[]): Distribucion {
  const validos = valores.filter((v) => Number.isFinite(v));
  return {
    n: validos.length,
    p50: percentil(validos, 50),
    p95: percentil(validos, 95),
    max: validos.length > 0 ? Math.max(...validos) : null,
  };
}

export function contar(claves: readonly string[]): Conteo[] {
  const conteo = new Map<string, number>();
  for (const clave of claves) conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  return [...conteo]
    .map(([clave, cantidad]) => ({ clave, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.clave.localeCompare(b.clave));
}

/** "Karla Menjívar" → "K. M*****". La auditoría no necesita el nombre completo. */
export function enmascararNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter((p) => p.length > 0);
  const inicial = (p: string) => p.charAt(0).toUpperCase();
  if (partes.length === 0) return "—";
  if (partes.length === 1) return `${inicial(partes[0])}.*****`;
  return `${inicial(partes[0])}. ${inicial(partes[1])}*****`;
}

/** modelo_version se guarda como "<modelo>/<versión del prompt>". */
export function modeloDe(modeloVersion: string): string {
  return modeloVersion.split("/")[0];
}

function duracionSegundos(conversacion: ConversacionFila): number | null {
  if (conversacion.cerradaEn === null) return null;
  const ms = Date.parse(conversacion.cerradaEn) - Date.parse(conversacion.iniciadaEn);
  return Number.isFinite(ms) && ms >= 0 ? ms / 1000 : null;
}

function agruparPor<T>(filas: readonly T[], clave: (fila: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const fila of filas) {
    const k = clave(fila);
    const grupo = grupos.get(k);
    if (grupo) grupo.push(fila);
    else grupos.set(k, [fila]);
  }
  return grupos;
}

const esDelAgente = (t: TurnoMetricasFila) => t.rol === "agente";

// --- Costo -----------------------------------------------------------------------

export function costoEstimado(
  turnos: readonly TurnoMetricasFila[],
  conversacionesConAgente: number,
  conversacionesConAcuerdo: number,
): CostoEstimado {
  let totalUsd = 0;
  let turnosCosteados = 0;
  let turnosSinPrecio = 0;
  let turnosSinTokens = 0;
  const modelosSinPrecio = new Set<string>();

  for (const turno of turnos.filter(esDelAgente)) {
    if (turno.tokensIn === null && turno.tokensOut === null) {
      turnosSinTokens += 1;
      continue;
    }
    const modelo = turno.modeloVersion === null ? null : modeloDe(turno.modeloVersion);
    const precio = modelo === null ? null : precioDe(modelo);
    if (precio === null) {
      turnosSinPrecio += 1;
      modelosSinPrecio.add(modelo ?? "desconocido");
      continue;
    }
    totalUsd +=
      ((turno.tokensIn ?? 0) * precio.entradaPorMillonUsd +
        (turno.tokensOut ?? 0) * precio.salidaPorMillonUsd) /
      1_000_000;
    turnosCosteados += 1;
  }

  return {
    totalUsd,
    turnosCosteados,
    turnosSinPrecio,
    turnosSinTokens,
    modelosSinPrecio: [...modelosSinPrecio].sort(),
    porConversacionUsd: conversacionesConAgente > 0 ? totalUsd / conversacionesConAgente : null,
    porAcuerdoUsd: conversacionesConAcuerdo > 0 ? totalUsd / conversacionesConAcuerdo : null,
    preciosVigentesAl: PRECIOS_VIGENTES_AL,
    fuente: PRECIOS_FUENTE,
  };
}

// --- Auditoría -------------------------------------------------------------------

export function filaAuditoria(
  conversacion: ConversacionFila,
  cliente: Cliente | undefined,
  turnos: readonly TurnoMetricasFila[],
  acuerdo: AcuerdoFila | undefined,
): FilaAuditoria {
  const delAgente = turnos.filter(esDelAgente);
  const latencias = delAgente.flatMap((t) => (t.latenciaMs === null ? [] : [t.latenciaMs]));

  return {
    conversacionId: conversacion.id,
    idCorto: conversacion.id.slice(0, 8),
    clienteEnmascarado: cliente ? enmascararNombre(cliente.nombre) : "Cliente no encontrado",
    producto: cliente?.producto ?? null,
    cuota: cliente?.cuota ?? null,
    canal: conversacion.canal,
    apertura: conversacion.apertura,
    estado: conversacion.estado,
    acuerdo:
      acuerdo && acuerdo.escalon !== null && acuerdo.tipo !== null
        ? {
            escalon: acuerdo.escalon,
            tipo: acuerdo.tipo,
            monto: acuerdo.monto,
            fechaAcordada: acuerdo.fechaAcordada,
          }
        : null,
    motivoNoAcuerdo: acuerdo?.motivoNoAcuerdo ?? null,
    turnos: turnos.length,
    latenciaP95Ms: percentil(latencias, 95),
    tokensEntrada: delAgente.reduce((s, t) => s + (t.tokensIn ?? 0), 0),
    tokensSalida: delAgente.reduce((s, t) => s + (t.tokensOut ?? 0), 0),
    intervencionesValidador: delAgente.filter((t) => t.validadorOk === false).length,
    iniciadaEn: conversacion.iniciadaEn,
    cerradaEn: conversacion.cerradaEn,
  };
}

// --- Resumen ---------------------------------------------------------------------

export function calcularResumen(datos: DatosDashboard, ahora: Date): ResumenDashboard {
  const clientesPorId = new Map(datos.clientes.map((c) => [c.id, c]));
  const turnosPorConversacion = agruparPor(datos.turnos, (t) => t.conversacionId);
  const acuerdoPorConversacion = new Map(datos.acuerdos.map((a) => [a.conversacionId, a]));

  const conAcuerdo = datos.conversaciones.filter((c) => c.estado === "cerrada_con_acuerdo");

  const auditoria = [...datos.conversaciones]
    .sort((a, b) => Date.parse(b.iniciadaEn) - Date.parse(a.iniciadaEn))
    .map((c) =>
      filaAuditoria(
        c,
        clientesPorId.get(c.clienteId),
        turnosPorConversacion.get(c.id) ?? [],
        acuerdoPorConversacion.get(c.id),
      ),
    );

  // Un mismo cliente puede tener varias conversaciones cerradas (ensayos del demo sin
  // reset). Sumarlas por conversación multiplicaría la cuota de Karla por cada ensayo.
  const clientesConAcuerdo = [...new Set(conAcuerdo.map((c) => c.clienteId))]
    .map((id) => clientesPorId.get(id))
    .filter((c): c is Cliente => c !== undefined);

  return {
    generadoEn: ahora.toISOString(),
    gestion: calcularGestion(datos, conAcuerdo, clientesConAcuerdo, acuerdoPorConversacion),
    cartera: calcularCartera(datos.clientes, ahora),
    tecnico: calcularTecnico(datos, conAcuerdo.length),
    provisiones: calcularProvisiones(clientesConAcuerdo),
    auditoria,
  };
}

function calcularGestion(
  datos: DatosDashboard,
  conAcuerdo: readonly ConversacionFila[],
  clientesConAcuerdo: readonly Cliente[],
  acuerdoPorConversacion: ReadonlyMap<string, AcuerdoFila>,
): MetricasGestion {
  const porEstado: Record<EstadoConversacion, number> = {
    abierta: 0,
    cerrada_con_acuerdo: 0,
    cerrada_sin_acuerdo: 0,
    escalada_humano: 0,
  };
  const porCanal = { texto: 0, voz: 0 };
  for (const c of datos.conversaciones) {
    porEstado[c.estado] += 1;
    porCanal[c.canal] += 1;
  }

  const cerradas = datos.conversaciones.filter((c) => ESTADOS_CERRADOS.has(c.estado)).length;

  const acuerdosConMonto = conAcuerdo
    .map((c) => acuerdoPorConversacion.get(c.id))
    .filter((a): a is AcuerdoFila => a !== undefined);
  const montos = acuerdosConMonto.flatMap((a) => (a.monto === null ? [] : [a.monto]));

  return {
    conversaciones: { total: datos.conversaciones.length, porEstado, porCanal },
    cierreConAcuerdo: tasa(porEstado.cerrada_con_acuerdo, cerradas),
    escalamientoHumano: tasa(porEstado.escalada_humano, cerradas),
    acuerdosPorEscalon: ESCALERA.map((e) => ({
      escalon: e.escalon,
      id: e.id,
      titulo: e.titulo,
      cantidad: datos.acuerdos.filter((a) => a.escalon === e.escalon).length,
    })),
    cuotasProtegidas: {
      montoUsd: clientesConAcuerdo.reduce((s, c) => s + c.cuota, 0),
      clientes: clientesConAcuerdo.length,
    },
    montoComprometido: {
      montoUsd: montos.reduce((s, m) => s + m, 0),
      acuerdosConMonto: montos.length,
      acuerdosSinMonto: acuerdosConMonto.length - montos.length,
    },
    motivosNoAcuerdo: contar(
      datos.acuerdos.flatMap((a) => (a.motivoNoAcuerdo === null ? [] : [a.motivoNoAcuerdo])),
    ),
  };
}

function calcularCartera(clientes: readonly Cliente[], ahora: Date): MetricasCartera {
  const porBanda: Record<BandaRiesgo | "SIN_BANDA", number> = {
    LOW: 0,
    MODERATE: 0,
    MODERATE_HIGH: 0,
    CRITICAL: 0,
    SIN_BANDA: 0,
  };
  const porMotivo: Record<MotivoContacto, number> = {
    atraso: 0,
    desalineacion_quincena: 0,
    desalineacion_remesa: 0,
    riesgo_alto: 0,
  };
  let total = 0;

  for (const cliente of clientes) {
    porBanda[cliente.riesgoBanda ?? "SIN_BANDA"] += 1;
    const { motivo } = diagnosticar(cliente, ahora);
    if (motivo !== null) {
      porMotivo[motivo] += 1;
      total += 1;
    }
  }

  return { totalClientes: clientes.length, porBanda, requierenContacto: { total, porMotivo } };
}

function calcularTecnico(datos: DatosDashboard, conversacionesConAcuerdo: number): MetricasTecnicas {
  const delAgente = datos.turnos.filter(esDelAgente);
  const conTokens = delAgente.filter((t) => t.tokensIn !== null || t.tokensOut !== null);
  const conversacionesConAgente = new Set(delAgente.map((t) => t.conversacionId)).size;

  const entrada = conTokens.reduce((s, t) => s + (t.tokensIn ?? 0), 0);
  const salida = conTokens.reduce((s, t) => s + (t.tokensOut ?? 0), 0);

  const conValidador = delAgente.filter((t) => t.validadorOk !== null);
  const intervenidos = conValidador.filter((t) => t.validadorOk === false);

  return {
    latenciaAgenteMs: distribucion(
      delAgente.flatMap((t) => (t.latenciaMs === null ? [] : [t.latenciaMs])),
    ),
    duracionConversacionSeg: distribucion(
      datos.conversaciones.flatMap((c) => {
        const d = duracionSegundos(c);
        return d === null ? [] : [d];
      }),
    ),
    tokens: {
      entrada,
      salida,
      turnosConTokens: conTokens.length,
      turnosSinTokens: delAgente.length - conTokens.length,
      promedioPorConversacion: {
        entrada: conversacionesConAgente > 0 ? entrada / conversacionesConAgente : null,
        salida: conversacionesConAgente > 0 ? salida / conversacionesConAgente : null,
      },
    },
    costo: costoEstimado(datos.turnos, conversacionesConAgente, conversacionesConAcuerdo),
    validador: {
      intervencion: tasa(intervenidos.length, conValidador.length),
      motivos: contar(
        intervenidos.flatMap((t) => (t.validadorMotivo === null ? [] : [t.validadorMotivo])),
      ),
    },
    modelos: contar(
      delAgente.flatMap((t) => (t.modeloVersion === null ? [] : [modeloDe(t.modeloVersion)])),
    ),
  };
}

function calcularProvisiones(clientesConAcuerdo: readonly Cliente[]): ProvisionesEvitadas {
  return {
    reservaEvitadaUsd: clientesConAcuerdo.reduce(
      (s, c) => s + reservaEvitadaUsd(c.saldo, c.diasAtraso),
      0,
    ),
    clientes: clientesConAcuerdo.length,
    supuesto: SUPUESTO_PROVISIONES,
  };
}
