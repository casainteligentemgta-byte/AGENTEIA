import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { AppActionButtons } from "@/components/app/app-action-buttons";
import { AppTabs } from "@/components/app/app-tabs";
import { VehicleCard } from "@/components/app/vehicle-card";
import { getUserVehiculos } from "@/lib/data/user-vehicles";
import { countRecordatoriosPendientesPorPlaca } from "@/lib/data/vehicle-history";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const vehiculos = await getUserVehiculos();

  const vehiculosConRecordatorios = await Promise.all(
    vehiculos.map(async (v) => ({
      vehiculo: v,
      pendientes: await countRecordatoriosPendientesPorPlaca(v.id, v.placa),
    }))
  );

  return (
    <>
      <AppHeader centered />

      <main className="px-4 pb-10 pt-2">
        <AppActionButtons />

        <div className="my-5">
          <AppTabs active="vehiculos" />
        </div>

        <div className="space-y-4 rounded-3xl bg-[#0f1f38]/90 p-4 ring-1 ring-white/5">
          {vehiculosConRecordatorios.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-600/60 px-6 py-12 text-center">
              <p className="text-zinc-200">Aún no tienes vehículos registrados</p>
              <p className="mt-2 text-sm text-zinc-500">
                Agrega un auto, moto, bici, tractor o maquinaria
              </p>
              <Link
                href="/app/vehiculos/nuevo"
                className="app-cta-btn mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
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
      </main>
    </>
  );
}
