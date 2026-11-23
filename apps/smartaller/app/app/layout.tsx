import type { Metadata } from "next";
import { getBrand } from "@/lib/brand";
import { JacTabbar } from "@/components/jac/jac-tabbar";

const brand = getBrand();

export const metadata: Metadata = {
  title: brand.copy.appTitle,
  description: "Gestiona el mantenimiento de todos tus vehículos desde un solo lugar.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const jac = brand.id === "jac";
  return (
    <div className={jac ? "min-h-screen bg-[#f3f4f8] text-[#1c1c22]" : "app-bg-dark min-h-screen text-zinc-100"}>
      <div className={`mx-auto min-h-screen max-w-lg${jac ? " pb-24" : ""}`}>{children}</div>
      {jac ? <JacTabbar /> : null}
    </div>
  );
}
