import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SmartTaller",
  description: "Gestión de mantenimientos para talleres mecánicos vía Telegram",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
