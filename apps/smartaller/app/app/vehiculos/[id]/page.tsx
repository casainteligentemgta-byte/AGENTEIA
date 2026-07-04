import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { AppVehicleFooter } from "@/components/app/app-vehicle-footer";
import { OdometerCard } from "@/components/app/odometer-card";
import { MaintenanceModuleCard } from "@/components/app/maintenance-module-card";
import { VisitHistory } from "@/components/app/visit-history";
import { WheelsGrid } from "@/components/app/wheels-grid";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getResumenTallerVehiculo } from "@/lib/data/vehicle-history";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { getEtiquetaVehiculo, getSubtituloVehiculo, getValorOdometro } from "@/lib/vehicles/format";
import type { VehiculoUsuario } from "@/lib/vehicles/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

function vehiculoConOdometroTaller(
  vehiculo: VehiculoUsuario,
  kmTaller: number | null
): VehiculoUsuario {
  if (kmTaller == null || vehiculo.unidad_odometro !== "km") return vehiculo;
  const actual = vehiculo.kilometraje_ultimo ?? 0;
  if (kmTaller <= actual) return vehiculo;
  return { ...vehiculo, kilometraje_ultimo: kmTaller };
}

export default async function VehiculoDetallePage({ params }: PageProps) {
  const { id } = params;
  const vehiculoBase = await getUserVehiculoById(id);

  if (!vehiculoBase) notFound();

  const resumen = await getResumenTallerVehiculo(id, vehiculoBase.placa);
  const vehiculo = vehiculoConOdometroTaller(vehiculoBase, resumen.ultimaVisitaKm);
  const kmActual = getValorOdometro(vehiculo);

  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  const titulo = getEtiquetaVehiculo(vehiculo);
  const subtitulo = getSubtituloVehiculo(vehiculo);

  const modulosSinNeumaticos = config.modulos.filter((m) => m.id !== "neumaticos");
  const tieneNeumaticos = config.modulos.some((m) => m.id === "neumaticos");

  const ultimoCentro = resumen.ultimoCentro ?? null;

  return (
    <div className="app-bg-light min-h-screen text-zinc-900">
      <AppHeader variant="light" centered />

      <main className="space-y-4 px-4 pb-28 pt-2">
        <OdometerCard
          vehiculo={vehiculo}
          ultimaVisita={resumen.ultimaVisita}
          ultimoCentro={ultimoCentro}
        />

        {resumen.vinculado && (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-2.5 text-center text-xs font-semibold text-emerald-800">
            ✓ Sincronizado con tu taller · {resumen.totalVisitas} visita(s)
          </div>
        )}

        {tieneNeumaticos && <WheelsGrid config={config} />}

        {modulosSinNeumaticos.map((modulo) => (
          <MaintenanceModuleCard
            key={modulo.id}
            modulo={modulo}
            visitasRegistradas={resumen.totalVisitas}
            historial={resumen.mantenimientos}
            kmActual={kmActual}
            proximoRecordatorio={resumen.proximoRecordatorio}
          />
        ))}

        <VisitHistory
          mantenimientos={resumen.mantenimientos}
          proximoRecordatorio={resumen.proximoRecordatorio}
        />

        {!resumen.vinculado && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
            <p className="text-2xl font-light text-zinc-300">Próximamente</p>
            <p className="mt-2 text-sm text-zinc-500">
              Chat con tu taller, gráficos de neumáticos y más
            </p>
          </div>
        )}
      </main>

      <AppVehicleFooter
        titulo={titulo}
        placa={vehiculo.placa}
        tipoVehiculo={vehiculo.tipo_vehiculo}
      />
    </div>
  );
}
