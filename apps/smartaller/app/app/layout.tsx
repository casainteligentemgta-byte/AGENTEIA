import type { Metadata } from "next";
import { getBrand } from "@/lib/brand";

const brand = getBrand();

export const metadata: Metadata = {
  title: brand.copy.appTitle,
  description: "Gestiona el mantenimiento de todos tus vehículos desde un solo lugar.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-bg-dark min-h-screen text-zinc-100">
      <div className="mx-auto min-h-screen max-w-lg">{children}</div>
    </div>
  );
}
