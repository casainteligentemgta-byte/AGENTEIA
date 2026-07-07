import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { getUserVehiculos } from "@/lib/data/user-vehicles";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { getEtiquetaVehiculo } from "@/lib/vehicles/format";
import { Bike, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BicicletasListPage() {
  const vehiculos = await getUserVehiculos();
  const bicicletas = vehiculos.filter((v) => v.tipo_vehiculo === "bicicleta");

  return (
    <div className="app-bg-light min-h-screen text-zinc-900">
      <AppHeader variant="light" centered />

      <main className="px-4 pb-12 pt-2">
        <h1 className="mb-1 text-xl font-bold">Mis bicicletas</h1>
        <p className="mb-4 text-sm text-zinc-500">
          SmartBike integrado en tus vehículos · desgaste por Strava
        </p>

        {bicicletas.length === 0 ? (
          <div className="app-card-white p-6 text-center text-sm text-zinc-500">
            No tienes bicicletas registradas.{" "}
            <Link href="/app/vehiculos/nuevo" className="font-semibold text-brand-700 hover:underline">
              Agrega una bicicleta
            </Link>{" "}
            desde Mis vehículos.
          </div>
        ) : (
          <ul className="space-y-3">
            {bicicletas.map((vehiculo) => {
              const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
              const titulo = getEtiquetaVehiculo(vehiculo);

              return (
                <li key={vehiculo.id}>
                  <Link
                    href={`/app/vehiculos/${vehiculo.id}`}
                    className="app-card-white flex items-center gap-3 p-4 transition hover:border-brand-200"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                      <Bike className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{titulo}</p>
                      <p className="text-xs text-zinc-500">
                        {config.labelCorto} · {vehiculo.placa}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
