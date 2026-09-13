import { DashboardVista } from "@/components/dashboard/DashboardVista";
import type { Cliente } from "@/lib/agent/types";
import { calcularResumen } from "@/lib/dashboard/metricas";
import type {
  AcuerdoFila,
  ConversacionFila,
  DatosDashboard,
  TurnoMetricasFila,
} from "@/lib/dashboard/types";

/**
 * `/dashboard/ejemplo` — la MISMA vista, con datos de ejemplo.
 *
 * Existe para poder trabajar la UI cuando Supabase está vacío o caído. Los números
 * los calcula `calcularResumen` real, igual que en producción: lo único sintético
 * son las filas de entrada.
 *
 * NO es el dashboard. El de verdad es `/dashboard` y lee Supabase. Esta ruta lleva
 * un banner permanente para que nadie confunda una cifra de ejemplo con una medida,
 * que es exactamente lo que prohíbe docs/dashboard-contrato.md. Se borra con:
 *   rm -r app/dashboard/ejemplo
 */

const HOY = new Date(2026, 8, 13);
const iso = (d: number, h = 9) => new Date(2026, 8, d, h, 0, 0).toISOString();

const base: Omit<Cliente, "id" | "slug" | "nombre"> = {
  edad: 30,
  distrito: "San Salvador",
  segmento: "Asalariado",
  tipoIngreso: "quincenal",
  diaIngreso1: 15,
  diaIngreso2: 30,
  diaRemesa: null,
  producto: "Crédito de consumo",
  cuota: 145,
  saldo: 1800,
  diaPago: 8,
  diasAtraso: 0,
  tieneDebitoAutomatico: false,
  riesgoScore: 55,
  riesgoBanda: "MODERATE",
};

const clientes: Cliente[] = [
  { ...base, id: "c1", slug: "karla", nombre: "Karla Menjívar", riesgoBanda: "MODERATE_HIGH", cuota: 87.4 },
  { ...base, id: "c2", slug: "jose", nombre: "José Portillo", riesgoBanda: "MODERATE", diaPago: 3, diaRemesa: 5, tipoIngreso: "irregular", cuota: 120 },
  { ...base, id: "c3", slug: "rosa", nombre: "Rosa Hernández", riesgoBanda: "CRITICAL", diasAtraso: 4, cuota: 132, saldo: 2600 },
  { ...base, id: "c4", slug: "wilber", nombre: "Wilber Alvarenga", riesgoBanda: null, cuota: 68, saldo: 900 },
  { ...base, id: "c5", slug: "marta", nombre: "Marta Cruz", riesgoBanda: "LOW", diaPago: 20, cuota: 154, tieneDebitoAutomatico: true },
  { ...base, id: "c6", slug: "nelson", nombre: "Nelson Rivas", riesgoBanda: "MODERATE", diaPago: 6, cuota: 210, saldo: 3100 },
  { ...base, id: "c7", slug: "ana", nombre: "Ana Portillo", riesgoBanda: "LOW", diaPago: 25, cuota: 98 },
  { ...base, id: "c8", slug: "luis", nombre: "Luis Mejía", riesgoBanda: "CRITICAL", diasAtraso: 9, cuota: 175, saldo: 4200 },
];

const conv = (
  id: string,
  clienteId: string,
  estado: ConversacionFila["estado"],
  dia: number,
  minutos: number | null,
): ConversacionFila => ({
  id,
  clienteId,
  canal: id === "v1" ? "voz" : "texto",
  apertura: "agente",
  estado,
  iniciadaEn: iso(dia),
  cerradaEn: minutos === null ? null : new Date(2026, 8, dia, 9, minutos, 0).toISOString(),
});

const conversaciones: ConversacionFila[] = [
  conv("k1", "c1", "cerrada_con_acuerdo", 10, 4),
  conv("k2", "c1", "cerrada_con_acuerdo", 11, 6),
  conv("j1", "c2", "cerrada_con_acuerdo", 10, 5),
  conv("r1", "c3", "cerrada_con_acuerdo", 11, 8),
  conv("w1", "c4", "cerrada_sin_acuerdo", 12, 3),
  conv("n1", "c6", "escalada_humano", 12, 7),
  conv("l1", "c8", "cerrada_sin_acuerdo", 12, 4),
  conv("v1", "c7", "cerrada_con_acuerdo", 13, 5),
  conv("a1", "c5", "abierta", 13, null),
];

const MODELO = "gemini-2.0-flash/v3";

function turnos(): TurnoMetricasFila[] {
  const filas: TurnoMetricasFila[] = [];
  const latencias = [620, 880, 1150, 740, 2100, 960, 1430, 810, 1290, 3050, 690, 1020];
  let i = 0;

  for (const c of conversaciones) {
    const cuantos = c.estado === "abierta" ? 2 : 3;
    for (let t = 0; t < cuantos; t += 1) {
      filas.push({
        conversacionId: c.id,
        indice: t * 2,
        rol: "cliente",
        creadoEn: c.iniciadaEn,
        latenciaMs: null,
        tokensIn: null,
        tokensOut: null,
        validadorOk: null,
        validadorMotivo: null,
        modeloVersion: null,
      });

      const fallo = i === 4 || i === 9;
      filas.push({
        conversacionId: c.id,
        indice: t * 2 + 1,
        rol: "agente",
        creadoEn: c.iniciadaEn,
        latenciaMs: latencias[i % latencias.length],
        tokensIn: 820 + i * 37,
        tokensOut: 74 + (i % 5) * 9,
        validadorOk: !fallo,
        validadorMotivo: fallo ? (i === 4 ? "demasiadas_frases" : "monto_inventado") : null,
        modeloVersion: MODELO,
      });
      i += 1;
    }
  }
  return filas;
}

const acuerdos: AcuerdoFila[] = [
  { conversacionId: "k1", escalon: 2, tipo: "mover_fecha", monto: null, fechaAcordada: "2026-09-16", motivoNoAcuerdo: null, creadoEn: iso(10) },
  { conversacionId: "k2", escalon: 2, tipo: "mover_fecha", monto: null, fechaAcordada: "2026-09-16", motivoNoAcuerdo: null, creadoEn: iso(11) },
  { conversacionId: "j1", escalon: 2, tipo: "mover_fecha", monto: null, fechaAcordada: "2026-09-06", motivoNoAcuerdo: null, creadoEn: iso(10) },
  { conversacionId: "r1", escalon: 5, tipo: "dividir_cuota", monto: 66, fechaAcordada: "2026-09-20", motivoNoAcuerdo: null, creadoEn: iso(11) },
  { conversacionId: "v1", escalon: 3, tipo: "abono_parcial", monto: 45, fechaAcordada: "2026-09-25", motivoNoAcuerdo: null, creadoEn: iso(13) },
  { conversacionId: "w1", escalon: null, tipo: null, monto: null, fechaAcordada: null, motivoNoAcuerdo: "Dijo que iba a pagar completo el 15", creadoEn: iso(12) },
  { conversacionId: "l1", escalon: null, tipo: null, monto: null, fechaAcordada: null, motivoNoAcuerdo: "Pidió que lo llamaran otro día", creadoEn: iso(12) },
  { conversacionId: "n1", escalon: 8, tipo: "pase_humano", monto: null, fechaAcordada: null, motivoNoAcuerdo: null, creadoEn: iso(12) },
];

const datos: DatosDashboard = { clientes, conversaciones, turnos: turnos(), acuerdos };

export default function DashboardDeEjemplo() {
  return (
    <>
      <p className="sticky top-0 z-50 bg-agricola-status-alert px-4 py-2 text-center text-[13px] font-semibold text-white">
        DATOS DE EJEMPLO · esta ruta no lee Supabase. El dashboard real es /dashboard
      </p>
      <DashboardVista inicial={calcularResumen(datos, HOY)} />
    </>
  );
}
