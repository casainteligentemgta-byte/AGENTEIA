import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SmartTaller — Gestión inteligente de talleres",
  description:
    "Registra mantenimientos vehiculares con IA. Envía fotos de facturas por Telegram y gestiona tu taller desde un dashboard moderno.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
