import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { VehicleCard } from "@/components/app/vehicle-card";
import { getUserVehiculos, countRecordatoriosPendientes } from "@/lib/data/user-vehicles";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const vehiculos = await getUserVehiculos();

  const vehiculosConRecordatorios = await Promise.all(
    vehiculos.map(async (v) => ({
      vehiculo: v,
      pendientes: await countRecordatoriosPendientes(v.id),
    }))
  );

  return (
    <>
      <AppHeader />

      <main className="px-4 pb-10 pt-2">
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link
            href="/app/centros"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-500 px-3 py-4 text-center text-sm font-medium text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-400"
          >
            <MapPin className="h-5 w-5" />
            Centros de servicio
          </Link>
          <Link
            href="/app/vehiculos/nuevo"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-blue-500 px-3 py-4 text-center text-sm font-medium text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-400"
          >
            <Plus className="h-5 w-5" />
            Agregar vehículo
          </Link>
        </div>

        <div className="mb-4 flex rounded-2xl bg-[#132238] p-1">
          <span className="flex-1 rounded-xl bg-[#1a2d4a] py-2.5 text-center text-sm font-semibold text-white">
            Mis vehículos
          </span>
          <span className="flex-1 py-2.5 text-center text-sm text-zinc-500">Timeline</span>
        </div>

        <div className="space-y-4 rounded-3xl bg-[#132238]/80 p-4">
          {vehiculosConRecordatorios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-600 px-6 py-12 text-center">
              <p className="text-zinc-300">Aún no tienes vehículos registrados</p>
              <p className="mt-2 text-sm text-zinc-500">
                Agrega un auto, moto, bici, tractor o maquinaria para empezar
              </p>
              <Link
                href="/app/vehiculos/nuevo"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Agregar vehículo
              </Link>
            </div>
          ) : (
            vehiculosConRecordatorios.map(({ vehiculo, pendientes }) => (
              <VehicleCard
                key={vehiculo.id}
                vehiculo={vehiculo}
                recordatoriosPendientes={pendientes}
              />
            ))
          )}
        </div>

        <p className="mt-8 text-center text-xs text-zinc-600">
          SmartTaller · App multivehículo
        </p>
      </main>
    </>
  );
}
