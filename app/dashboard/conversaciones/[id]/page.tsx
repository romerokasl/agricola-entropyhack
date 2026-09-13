import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { obtenerDetalleConversacion } from "@/lib/dashboard/servicio";
import type { DetalleConversacion } from "@/lib/dashboard/types";

import { AvisoError, Datos, Seccion, Tabla, Tarjeta } from "../../componentes";
import {
  entero,
  ETIQUETA_ESTADO,
  etiquetaEscalon,
  etiquetaValidador,
  fecha,
  ms,
  SIN_DATO,
  usd,
} from "../../formato";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Conversación · Dashboard" };

export default async function DetalleConversacionPage({ params }: { params: { id: string } }) {
  let detalle: DetalleConversacion | null;
  try {
    detalle = await obtenerDetalleConversacion(params.id);
  } catch (e: unknown) {
    return <AvisoError mensaje={e instanceof Error ? e.message : "Error desconocido"} />;
  }
  if (detalle === null) notFound();

  const { fila, turnos, acuerdoRegistrado } = detalle;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6">
      <header className="flex flex-col gap-1">
        <Link href="/dashboard" className="text-sm underline">
          ← Volver al dashboard
        </Link>
        <h1 className="text-2xl font-semibold">
          Conversación <span className="font-mono">{fila.idCorto}</span>
        </h1>
        <p className="font-mono text-xs text-agricola-dark-muted">{fila.conversacionId}</p>
      </header>

      <Seccion titulo="Resumen">
        <Tarjeta>
          <Datos
            items={[
              ["Cliente", fila.clienteEnmascarado],
              ["Producto", fila.producto ?? SIN_DATO],
              ["Cuota", usd(fila.cuota)],
              ["Estado", ETIQUETA_ESTADO[fila.estado]],
              ["Canal", fila.canal],
              ["Abrió", fila.apertura],
              ["Iniciada", fecha(fila.iniciadaEn)],
              ["Cerrada", fecha(fila.cerradaEn)],
              ["Turnos", entero(fila.turnos)],
              ["Latencia p95 del agente", ms(fila.latenciaP95Ms)],
              ["Tokens in / out", `${entero(fila.tokensEntrada)} / ${entero(fila.tokensSalida)}`],
              ["Intervenciones del validador", entero(fila.intervencionesValidador)],
            ]}
          />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Registro en la tabla acuerdos" nota="Los campos tal como quedaron guardados.">
        {acuerdoRegistrado === null ? (
          <p className="text-sm text-agricola-dark-muted">
            Sin registro: la conversación sigue abierta o se cortó antes de cerrar.
          </p>
        ) : (
          <Tarjeta>
            <Datos
              items={[
                ["escalon", acuerdoRegistrado.escalon ?? "null"],
                [
                  "tipo",
                  acuerdoRegistrado.tipo === null
                    ? "null"
                    : `${acuerdoRegistrado.tipo} (${etiquetaEscalon(acuerdoRegistrado.tipo)})`,
                ],
                ["monto", acuerdoRegistrado.monto === null ? "null" : usd(acuerdoRegistrado.monto)],
                ["fecha_acordada", acuerdoRegistrado.fechaAcordada ?? "null"],
                ["motivo_no_acuerdo", acuerdoRegistrado.motivoNoAcuerdo ?? "null"],
                ["creado_en", fecha(acuerdoRegistrado.creadoEn)],
              ]}
            />
          </Tarjeta>
        )}
      </Seccion>

      <Seccion titulo="Transcripción" nota="Completa y en orden. Las métricas solo existen en los turnos del agente.">
        <Tabla
          vacio="La conversación no tiene turnos."
          encabezados={["#", "Rol", "Texto", "Latencia", "Tokens in / out", "Validador", "Modelo", "Hora"]}
          filas={turnos.map((t) => [
            t.indice,
            t.rol,
            <p key="texto" className="min-w-[18rem] max-w-xl whitespace-pre-wrap">
              {t.texto}
            </p>,
            ms(t.latenciaMs),
            t.rol === "agente" ? `${entero(t.tokensIn)} / ${entero(t.tokensOut)}` : SIN_DATO,
            t.validadorOk === null
              ? SIN_DATO
              : t.validadorOk
                ? "Pasó"
                : `Intervino: ${t.validadorMotivo === null ? "sin motivo" : etiquetaValidador(t.validadorMotivo)}`,
            t.modeloVersion ?? SIN_DATO,
            fecha(t.creadoEn),
          ])}
        />
      </Seccion>
    </main>
  );
}
