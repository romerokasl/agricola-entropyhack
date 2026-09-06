import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coming...",
  description: "Bancoagrícola EntropyHack",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full bg-black">
      <body className="h-full bg-black text-white m-0 p-0 antialiased">
        {children}
      </body>
    </html>
  );
}
