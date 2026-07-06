import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartTaller — Mantenimientos",
  description: "Gestión de mantenimientos vía Telegram para talleres y concesionarios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
