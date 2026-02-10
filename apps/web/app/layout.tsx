import type { Metadata } from "next";
import "./globals.css";

const agentName = process.env.NEXT_PUBLIC_AGENT_NAME || "Agente IA";

export const metadata: Metadata = {
  title: agentName,
  description: "Asistente con memoria",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="antialiased">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">
        {children}
      </body>
    </html>
  );
}
