import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HojaInspeccionPlantilla } from "@/components/dashboard/hoja-inspeccion-plantilla";

export const dynamic = "force-dynamic";

export default function HojaInspeccionPage() {
  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/dashboard/vehiculos/nuevo"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 print:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a registrar vehículo
      </Link>

      <div className="mb-6 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Hoja de inspección</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Planilla en blanco para imprimir o guardar como PDF
        </p>
      </div>

      <HojaInspeccionPlantilla />
    </div>
  );
}
