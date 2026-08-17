import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Puerto Libre — Importación vehicular",
  description:
    "Expedientes de importación, desaduanamiento SENIAT y nacionalización. App independiente de Puerto Libre.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND.name,
  },
};

export const viewport: Viewport = {
  themeColor: BRAND.colors.primary,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
