import { getVehiculos } from "@/lib/data/dashboard";
import { formatDate, formatKm } from "@/lib/utils";

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
            <div key={v.id} className="glass rounded-2xl p-5 transition hover:border-blue-500/20">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold tracking-wide text-blue-400">{v.placa}</p>
                  <p className="mt-1 text-zinc-300">{v.nombre_cliente ?? "Sin nombre"}</p>
                </div>
                <span className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-500">
                  {formatKm(v.kilometraje_ultimo)}
                </span>
              </div>
              <div className="mt-4 space-y-1 text-sm text-zinc-500">
                {v.telefono_cliente && <p>Tel: {v.telefono_cliente}</p>}
                <p>Registrado: {formatDate(v.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
