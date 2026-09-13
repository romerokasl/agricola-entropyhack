import type { ReactNode } from "react";

/**
 * El layout raíz pinta fondo negro y texto blanco. Este contenedor le devuelve al
 * dashboard un fondo claro legible sin tocar el layout raíz ni /chat.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-agricola-bg text-agricola-dark">{children}</div>;
}
