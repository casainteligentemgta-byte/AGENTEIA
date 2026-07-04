import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SmartTaller — Tu vehículo",
  description: "Gestiona el mantenimiento de todos tus vehículos desde un solo lugar.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a1628] text-zinc-100">
      <div className="mx-auto min-h-screen max-w-lg">{children}</div>
    </div>
  );
}
