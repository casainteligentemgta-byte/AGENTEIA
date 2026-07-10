import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
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

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Registrar vehículo</h1>
          <p className="mt-1 text-zinc-500">
            Registra los datos del vehículo. La inspección se inicia después, desde la ficha del
            vehículo o escaneando la placa por Telegram.
          </p>
        </div>
        <Link
          href="/dashboard/hoja-inspeccion"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-blue-500 hover:text-blue-300"
        >
          <FileText className="h-4 w-4" />
          Planilla de inspección (PDF)
        </Link>
      </div>

      <VehiculoCreateForm />
    </div>
  );
}
