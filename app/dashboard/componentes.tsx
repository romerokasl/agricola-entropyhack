import type { ReactNode } from "react";

/**
 * Presentación mínima a propósito: la UI definitiva la hace otra persona del equipo.
 * Estos componentes solo tienen que ser legibles y no esconder el n de nada.
 */

export function Seccion({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        {nota && <p className="text-sm text-agricola-dark-muted">{nota}</p>}
      </div>
      {children}
    </section>
  );
}

export function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-agricola-border bg-agricola-bg-white p-4">
      {children}
    </div>
  );
}

export function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <Tarjeta>
      <p className="text-sm text-agricola-dark-muted">{etiqueta}</p>
      <p className="text-3xl font-semibold tabular-nums">{valor}</p>
      <p className="text-xs text-agricola-dark-muted">{detalle}</p>
    </Tarjeta>
  );
}

export function Datos({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {items.map(([etiqueta, valor]) => (
        <div key={etiqueta} className="flex justify-between gap-4 border-b border-agricola-border-light py-1">
          <dt className="text-agricola-dark-muted">{etiqueta}</dt>
          <dd className="text-right font-medium tabular-nums">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabla({ encabezados, filas, vacio }: { encabezados: string[]; filas: ReactNode[][]; vacio: string }) {
  if (filas.length === 0) return <p className="text-sm text-agricola-dark-muted">{vacio}</p>;

  return (
    <div className="overflow-x-auto rounded-card border border-agricola-border bg-agricola-bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-agricola-bg-alt text-agricola-dark-muted">
          <tr>
            {encabezados.map((e) => (
              <th key={e} className="whitespace-nowrap px-3 py-2 font-medium">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t border-agricola-border-light align-top">
              {fila.map((celda, j) => (
                <td key={j} className="px-3 py-2 tabular-nums">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barra proporcional al máximo de su grupo. Con máximo 0 no dibuja nada. */
export function Barra({ valor, maximo }: { valor: number; maximo: number }) {
  const ancho = maximo > 0 ? (valor / maximo) * 100 : 0;
  return (
    <div className="h-2 w-32 rounded-full bg-agricola-bg-alt">
      <div className="h-2 rounded-full bg-agricola-brand-green" style={{ width: `${ancho}%` }} />
    </div>
  );
}

export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-agricola-yellow-dark bg-agricola-yellow-light p-4 text-sm">
      {children}
    </div>
  );
}

export function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">No se pudieron cargar los datos del dashboard</h1>
      <div className="rounded-card border border-agricola-status-alert bg-agricola-status-alert-bg p-4 text-sm">
        <p className="font-medium">{mensaje}</p>
        <p className="mt-2 text-agricola-dark-muted">
          Supabase falla de forma transitoria en el tier gratuito: probá recargar. Si persiste,
          revisá NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.
        </p>
      </div>
    </main>
  );
}
