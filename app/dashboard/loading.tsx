import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto con la misma geometría que la vista real, para que el salto al cargar
 * no mueva el layout.
 */
export default function Cargando() {
  return (
    <main className="mx-auto flex max-w-[1360px] flex-col gap-8 px-5 py-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-48 bg-agricola-border" />
          <Skeleton className="h-7 w-80 bg-agricola-border" />
          <Skeleton className="h-3 w-60 bg-agricola-border" />
        </div>
        <Skeleton className="h-9 w-48 bg-agricola-border" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[128px] rounded-card bg-agricola-border" />
        ))}
      </div>

      <Skeleton className="h-[112px] rounded-card bg-agricola-border" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full max-w-lg rounded-lg bg-agricola-border" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-[220px] rounded-card bg-agricola-border" />
          <Skeleton className="h-[220px] rounded-card bg-agricola-border" />
        </div>
      </div>
    </main>
  );
}
