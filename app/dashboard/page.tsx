import type { Metadata } from "next";
import Link from "next/link";

import { obtenerResumenDashboard } from "@/lib/dashboard/servicio";
import type { Conteo, ResumenDashboard } from "@/lib/dashboard/types";

import BotonActualizar from "./BotonActualizar";
import { Aviso, AvisoError, Barra, Datos, Kpi, Seccion, Tabla, Tarjeta } from "./componentes";
import {
  duracion,
  entero,
  ETIQUETA_BANDA,
  ETIQUETA_ESTADO,
  ETIQUETA_MOTIVO_CONTACTO,
  etiquetaEscalon,
  etiquetaValidador,
  fecha,
  fraccion,
  ms,
  ORDEN_BANDAS,
  porcentaje,
  SIN_DATO,
  usd,
} from "./formato";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard · Cobranza preventiva" };

export default async function DashboardPage() {
  let resumen: ResumenDashboard;
  try {
    resumen = await obtenerResumenDashboard();
  } catch (e: unknown) {
    return <AvisoError mensaje={e instanceof Error ? e.message : "Error desconocido"} />;
  }

  const { gestion, cartera, tecnico, provisiones, auditoria } = resumen;
  const { costo } = tecnico;
  const maxEscalon = Math.max(0, ...gestion.acuerdosPorEscalon.map((e) => e.cantidad));

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard de cobranza preventiva</h1>
          <p className="text-sm text-agricola-dark-muted">
            Consola interna · calculado desde Supabase el {fecha(resumen.generadoEn)}
          </p>
        </div>
        <BotonActualizar />
      </header>

      {gestion.conversaciones.total === 0 && (
        <Aviso>
          Todavía no hay conversaciones registradas (la base se vacía con{" "}
          <code>npm run demo:reset</code>). Las métricas de gestión y las técnicas aparecen en cuanto
          se abra la primera. La cartera sí se calcula ya.
        </Aviso>
      )}

      {/* --- Fila principal: las cuatro cifras del pitch --------------------------- */}
      <Seccion titulo="Resumen">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            etiqueta="Cierre con acuerdo"
            valor={porcentaje(gestion.cierreConAcuerdo)}
            detalle={`${fraccion(gestion.cierreConAcuerdo)} conversaciones cerradas (sin contar abiertas)`}
          />
          <Kpi
            etiqueta="Cuotas protegidas con acuerdo"
            valor={usd(gestion.cuotasProtegidas.montoUsd)}
            detalle={`${gestion.cuotasProtegidas.clientes} cliente(s); cada cliente cuenta una vez`}
          />
          <Kpi
            etiqueta="Latencia del agente (p95)"
            valor={ms(tecnico.latenciaAgenteMs.p95)}
            detalle={`n = ${tecnico.latenciaAgenteMs.n} turnos · p50 ${ms(tecnico.latenciaAgenteMs.p50)}`}
          />
          <Kpi
            etiqueta="Costo estimado de operación"
            valor={costo.turnosCosteados === 0 ? SIN_DATO : usd(costo.totalUsd)}
            detalle={`${costo.turnosCosteados} turnos a precio de lista. Hoy corre en tier gratuito ($0).`}
          />
        </div>
      </Seccion>

      {/* --- Gestión ---------------------------------------------------------------- */}
      <Seccion titulo="Resultado de la gestión">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Tarjeta>
            <h3 className="font-medium">Conversaciones por estado</h3>
            <Datos
              items={[
                ...(Object.keys(ETIQUETA_ESTADO) as Array<keyof typeof ETIQUETA_ESTADO>).map(
                  (estado): [string, string] => [ETIQUETA_ESTADO[estado], entero(gestion.conversaciones.porEstado[estado])],
                ),
                ["Total", entero(gestion.conversaciones.total)],
                ["Canal texto", entero(gestion.conversaciones.porCanal.texto)],
                ["Canal voz", entero(gestion.conversaciones.porCanal.voz)],
              ]}
            />
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-medium">Montos y escalamiento</h3>
            <Datos
              items={[
                ["Cuotas protegidas con acuerdo", usd(gestion.cuotasProtegidas.montoUsd)],
                ["Monto comprometido en acuerdos", usd(gestion.montoComprometido.montoUsd)],
                [
                  "Acuerdos con / sin monto registrado",
                  `${gestion.montoComprometido.acuerdosConMonto} / ${gestion.montoComprometido.acuerdosSinMonto}`,
                ],
                [
                  "Escalamiento a asesor humano",
                  `${porcentaje(gestion.escalamientoHumano)} (${fraccion(gestion.escalamientoHumano)})`,
                ],
              ]}
            />
            <p className="text-xs text-agricola-dark-muted">
              Cuotas protegidas: suma de la cuota de cada cliente con al menos una conversación
              cerrada con acuerdo. Monto comprometido: suma de acuerdos.monto; un débito
              automático, por ejemplo, no registra monto.
            </p>
          </Tarjeta>
        </div>

        <Tabla
          encabezados={["Escalón", "Opción", "Acuerdos", ""]}
          vacio=""
          filas={gestion.acuerdosPorEscalon.map((e) => [
            e.escalon,
            e.titulo,
            e.cantidad,
            <Barra key="barra" valor={e.cantidad} maximo={maxEscalon} />,
          ])}
        />

        <TablaConteo
          titulo="Motivos de no-acuerdo"
          conteos={gestion.motivosNoAcuerdo}
          etiqueta={(clave) => clave}
          vacio="No hay conversaciones cerradas sin acuerdo."
        />
      </Seccion>

      {/* --- Cartera ---------------------------------------------------------------- */}
      <Seccion
        titulo="Cartera"
        nota="Clientes sembrados. 'Requieren contacto' usa la misma regla con la que el agente decide abrir una conversación."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Tarjeta>
            <h3 className="font-medium">Clientes por banda de riesgo</h3>
            <Datos
              items={[
                ...ORDEN_BANDAS.map((b): [string, string] => [ETIQUETA_BANDA[b], entero(cartera.porBanda[b])]),
                ["Total", entero(cartera.totalClientes)],
              ]}
            />
          </Tarjeta>
          <Tarjeta>
            <h3 className="font-medium">
              Requieren contacto: {entero(cartera.requierenContacto.total)} de {entero(cartera.totalClientes)}
            </h3>
            <Datos
              items={(Object.keys(ETIQUETA_MOTIVO_CONTACTO) as Array<keyof typeof ETIQUETA_MOTIVO_CONTACTO>).map(
                (m): [string, string] => [ETIQUETA_MOTIVO_CONTACTO[m], entero(cartera.requierenContacto.porMotivo[m])],
              )}
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* --- Técnico ---------------------------------------------------------------- */}
      <Seccion titulo="Solidez técnica">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Tarjeta>
            <h3 className="font-medium">Latencia y duración</h3>
            <Datos
              items={[
                ["Latencia del agente p50", ms(tecnico.latenciaAgenteMs.p50)],
                ["Latencia del agente p95", ms(tecnico.latenciaAgenteMs.p95)],
                ["Latencia del agente máxima", ms(tecnico.latenciaAgenteMs.max)],
                ["Turnos medidos (n)", entero(tecnico.latenciaAgenteMs.n)],
                ["Duración de conversación p50", duracion(tecnico.duracionConversacionSeg.p50)],
                ["Duración de conversación p95", duracion(tecnico.duracionConversacionSeg.p95)],
                ["Conversaciones cerradas medidas (n)", entero(tecnico.duracionConversacionSeg.n)],
              ]}
            />
            <p className="text-xs text-agricola-dark-muted">
              La latencia de un turno incluye las llamadas a herramientas y, si lo hubo, el reintento
              que pidió el validador. Percentiles por nearest-rank.
            </p>
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-medium">Tokens y costo estimado</h3>
            <Datos
              items={[
                ["Tokens de entrada", entero(tecnico.tokens.entrada)],
                ["Tokens de salida", entero(tecnico.tokens.salida)],
                ["Entrada promedio por conversación", entero(tecnico.tokens.promedioPorConversacion.entrada)],
                ["Salida promedio por conversación", entero(tecnico.tokens.promedioPorConversacion.salida)],
                ["Costo total estimado", costo.turnosCosteados === 0 ? SIN_DATO : usd(costo.totalUsd)],
                ["Costo por conversación", usd(costo.porConversacionUsd)],
                ["Costo por acuerdo logrado", usd(costo.porAcuerdoUsd)],
                ["Turnos costeados", entero(costo.turnosCosteados)],
                ["Turnos sin tokens registrados", entero(costo.turnosSinTokens)],
                [
                  "Turnos sin precio conocido",
                  costo.turnosSinPrecio === 0
                    ? "0"
                    : `${costo.turnosSinPrecio} (${costo.modelosSinPrecio.join(", ")})`,
                ],
              ]}
            />
            <p className="text-xs text-agricola-dark-muted">
              Precio de lista del tier pagado al {costo.preciosVigentesAl} (
              <a href={costo.fuente} className="underline" target="_blank" rel="noreferrer">
                fuente
              </a>
              ). El demo usa el tier gratuito, así que hoy el costo real es $0. Es un piso: los
              tokens de salida registrados no incluyen los de razonamiento, que sí se cobran.
            </p>
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-medium">Validador</h3>
            <Datos
              items={[
                [
                  "Turnos con intervención",
                  `${porcentaje(tecnico.validador.intervencion)} (${fraccion(tecnico.validador.intervencion)})`,
                ],
              ]}
            />
            <p className="text-xs text-agricola-dark-muted">
              Cuenta como intervención cualquier respuesta que no pasó a la primera, aunque el
              reintento haya salido bien.
            </p>
            <TablaConteo
              titulo="Motivos"
              conteos={tecnico.validador.motivos}
              etiqueta={etiquetaValidador}
              vacio="El validador no ha tenido que intervenir."
            />
          </Tarjeta>

          <Tarjeta>
            <h3 className="font-medium">Modelos que atendieron turnos</h3>
            <TablaConteo
              titulo=""
              conteos={tecnico.modelos}
              etiqueta={(clave) => clave}
              vacio="Todavía no hay turnos del agente."
            />
          </Tarjeta>
        </div>
      </Seccion>

      {/* --- Provisiones (Nivel 3) ------------------------------------------------- */}
      <Seccion titulo="Provisiones evitadas (NCB-022)" nota={provisiones.supuesto}>
        <Tarjeta>
          <Datos
            items={[
              ["Reserva evitada estimada", usd(provisiones.reservaEvitadaUsd)],
              ["Clientes considerados", entero(provisiones.clientes)],
            ]}
          />
        </Tarjeta>
      </Seccion>

      {/* --- Auditoría -------------------------------------------------------------- */}
      <Seccion titulo="Auditoría de conversaciones" nota="De la más reciente a la más antigua.">
        <Tabla
          vacio="No hay conversaciones registradas."
          encabezados={[
            "ID",
            "Cliente",
            "Producto",
            "Cuota",
            "Estado",
            "Resultado",
            "Turnos",
            "Latencia p95",
            "Tokens in / out",
            "Intervenciones",
            "Iniciada",
          ]}
          filas={auditoria.map((f) => [
            <Link key="id" href={`/dashboard/conversaciones/${f.conversacionId}`} className="font-mono underline">
              {f.idCorto}
            </Link>,
            f.clienteEnmascarado,
            f.producto ?? SIN_DATO,
            usd(f.cuota),
            ETIQUETA_ESTADO[f.estado],
            f.acuerdo
              ? `E${f.acuerdo.escalon} · ${etiquetaEscalon(f.acuerdo.tipo)} · ${usd(f.acuerdo.monto)} · ${f.acuerdo.fechaAcordada ?? SIN_DATO}`
              : (f.motivoNoAcuerdo ?? SIN_DATO),
            f.turnos,
            ms(f.latenciaP95Ms),
            `${entero(f.tokensEntrada)} / ${entero(f.tokensSalida)}`,
            f.intervencionesValidador,
            fecha(f.iniciadaEn),
          ])}
        />
      </Seccion>
    </main>
  );
}

function TablaConteo({
  titulo,
  conteos,
  etiqueta,
  vacio,
}: {
  titulo: string;
  conteos: Conteo[];
  etiqueta: (clave: string) => string;
  vacio: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {titulo && <h3 className="font-medium">{titulo}</h3>}
      <Tabla
        encabezados={["", "Cantidad"]}
        vacio={vacio}
        filas={conteos.map((c) => [etiqueta(c.clave), c.cantidad])}
      />
    </div>
  );
}
