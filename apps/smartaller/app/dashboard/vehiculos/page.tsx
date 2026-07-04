import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getVehiculos } from "@/lib/data/dashboard";
import { formatDate, formatKm, formatOdometroDashboard } from "@/lib/utils";
import { getEtiquetaTipo } from "@/lib/vehicles/format";
import type { TipoVehiculo } from "@/lib/vehicles/types";

export const dynamic = "force-dynamic";

export default async function VehiculosPage() {
  const vehiculos = await getVehiculos();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vehículos</h1>
        <p className="mt-1 text-zinc-500">Flota registrada en tu taller</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {vehiculos.length === 0 ? (
          <div className="glass col-span-full rounded-2xl px-5 py-16 text-center">
            <p className="text-zinc-400">No hay vehículos registrados</p>
            <p className="mt-1 text-sm text-zinc-600">
              Se crean automáticamente al procesar una factura
            </p>
          </div>
        ) : (
          vehiculos.map((v) => (
            <Link
              key={v.id}
              href={`/dashboard/vehiculos/${v.id}`}
              className="glass group rounded-2xl p-5 transition hover:border-blue-500/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-wide text-blue-400">{v.placa}</p>
                  <p className="mt-1 text-zinc-300">
                    {v.nick ?? v.nombre_cliente ?? "Sin nombre"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {getEtiquetaTipo(v.tipo_vehiculo as TipoVehiculo)}
                    {v.marca && v.modelo ? ` · ${v.marca} ${v.modelo}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-500">
                    {formatOdometroDashboard(v.kilometraje_ultimo, v.horas_motor_ultimo, v.unidad_odometro)}
                  </span>
                  <ChevronRight className="h-5 w-5 text-zinc-600 transition group-hover:text-blue-400" />
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm text-zinc-500">
                {v.telefono_cliente ? (
                  <p>Tel: {v.telefono_cliente}</p>
                ) : (
                  <p className="text-amber-500/80">Sin teléfono — agregar para WhatsApp</p>
                )}
                <p>Km: {formatKm(v.kilometraje_ultimo)}</p>
                <p>Registrado: {formatDate(v.created_at)}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
