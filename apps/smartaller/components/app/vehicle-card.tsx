import Link from "next/link";
import { CalendarClock, Pencil } from "lucide-react";
import type { VehiculoUsuario } from "@/lib/vehicles/types";
import { getEtiquetaTipo, getEtiquetaVehiculo, getSubtituloVehiculo } from "@/lib/vehicles/format";
import { VehicleTypeIcon } from "@/components/app/vehicle-type-picker";

type VehicleCardProps = {
  vehiculo: VehiculoUsuario;
  recordatoriosPendientes?: number;
};

export function VehicleCard({ vehiculo, recordatoriosPendientes = 0 }: VehicleCardProps) {
  const titulo = getEtiquetaVehiculo(vehiculo);
  const subtitulo = getSubtituloVehiculo(vehiculo);

  return (
    <Link
      href={`/app/vehiculos/${vehiculo.id}`}
      className="group relative block rounded-2xl bg-white p-4 shadow-md transition hover:shadow-lg"
    >
      <div className="flex gap-4">
        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
          <VehicleTypeIcon tipo={vehiculo.tipo_vehiculo} className="h-10 w-10" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-zinc-900">{titulo}</p>
          {subtitulo ? (
            <p className="truncate text-sm text-zinc-500">{subtitulo}</p>
          ) : (
            <p className="text-sm text-zinc-400">{getEtiquetaTipo(vehiculo.tipo_vehiculo)}</p>
          )}
          <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">{vehiculo.placa}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-700">
            <CalendarClock className="h-5 w-5" />
            {recordatoriosPendientes > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {recordatoriosPendientes}
              </span>
            )}
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 opacity-0 transition group-hover:opacity-100">
            <Pencil className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
