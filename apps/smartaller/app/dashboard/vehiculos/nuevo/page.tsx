import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VehiculoCreateForm } from "@/components/dashboard/vehiculo-create-form";

export const dynamic = "force-dynamic";

export default function NuevoVehiculoPage() {
  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/dashboard/vehiculos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a vehículos
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Registrar vehículo</h1>
        <p className="mt-1 text-zinc-500">
          Agrega cada unidad vendida o entregada para dar seguimiento desde el primer día
        </p>
      </div>

      <VehiculoCreateForm />
    </div>
  );
}
