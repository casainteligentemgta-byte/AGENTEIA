import Link from "next/link";
import { CalendarClock, Pencil } from "lucide-react";
import type { VehiculoUsuario } from "@/lib/vehicles/types";
import { getEtiquetaTipo, getEtiquetaVehiculo } from "@/lib/vehicles/format";
import { VehicleTypeIcon } from "@/components/app/vehicle-type-picker";

type VehicleCardProps = {
  vehiculo: VehiculoUsuario;
  recordatoriosPendientes?: number;
};

export function VehicleCard({ vehiculo, recordatoriosPendientes = 0 }: VehicleCardProps) {
  const titulo = getEtiquetaVehiculo(vehiculo);
  const lineaMarca = [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" — ");

  return (
    <Link
      href={`/app/vehiculos/${vehiculo.id}`}
      className="app-card-white group relative block p-4 transition hover:shadow-lg"
    >
      <div className="flex gap-4">
        <div className="flex h-[5.5rem] w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-400">
          <VehicleTypeIcon tipo={vehiculo.tipo_vehiculo} className="h-12 w-12" />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="truncate text-base font-bold text-zinc-900">{titulo}</p>
          {lineaMarca && (
            <p className="truncate text-sm text-zinc-700">{lineaMarca}</p>
          )}
          {vehiculo.color && (
            <p className="truncate text-sm capitalize text-zinc-500">{vehiculo.color}</p>
          )}
          {!lineaMarca && !vehiculo.color && (
            <p className="text-sm text-zinc-400">{getEtiquetaTipo(vehiculo.tipo_vehiculo)}</p>
          )}
          <p className="mt-1 text-sm font-medium uppercase tracking-wide text-zinc-800">
            {vehiculo.placa}
          </p>
        </div>
        <div className="flex flex-col items-end justify-between py-0.5">
          <span className="relative flex h-10 w-10 items-center justify-center text-zinc-800">
            <CalendarClock className="h-6 w-6" strokeWidth={1.75} />
            {recordatoriosPendientes > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {recordatoriosPendientes}
              </span>
            )}
          </span>
          <span className="flex h-8 w-8 items-center justify-center text-zinc-400 opacity-60 transition group-hover:opacity-100">
            <Pencil className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
