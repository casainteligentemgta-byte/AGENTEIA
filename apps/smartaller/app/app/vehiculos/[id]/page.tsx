import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { AppVehicleFooter } from "@/components/app/app-vehicle-footer";
import { MantenimientoB2cForm } from "@/components/app/mantenimiento-b2c-form";
import { OdometerCard } from "@/components/app/odometer-card";
import { MaintenanceModuleCard } from "@/components/app/maintenance-module-card";
import { VehicleHealthDashboard } from "@/components/app/vehicle-health-dashboard";
import { VisitHistory } from "@/components/app/visit-history";
import { WheelsGrid } from "@/components/app/wheels-grid";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getResumenTallerVehiculo } from "@/lib/data/vehicle-history";
import {
  getOrEnsurePerfil,
  perfilSuscripcionVigente,
  usuarioTieneVehiculoTaller,
} from "@/lib/data/perfil";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { getEtiquetaVehiculo, getSubtituloVehiculo, getValorOdometro } from "@/lib/vehicles/format";
import { buildVehicleHealthSummary } from "@/lib/vehicles/vehicle-health";
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

  const [resumen, perfil, tieneVinculoTaller] = await Promise.all([
    getResumenTallerVehiculo(id, vehiculoBase.placa),
    getOrEnsurePerfil(),
    usuarioTieneVehiculoTaller(),
  ]);

  const puedeRegistrarMantenimiento =
    !resumen.vinculado &&
    (tieneVinculoTaller || (perfil != null && perfilSuscripcionVigente(perfil)));

  const vehiculo = vehiculoConOdometroTaller(vehiculoBase, resumen.ultimaVisitaKm);
  const kmActual = getValorOdometro(vehiculo);

  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  const titulo = getEtiquetaVehiculo(vehiculo);
  const subtitulo = getSubtituloVehiculo(vehiculo);

  const modulosSinNeumaticos = config.modulos.filter((m) => m.id !== "neumaticos");
  const tieneNeumaticos = config.modulos.some((m) => m.id === "neumaticos");

  const ultimoCentro = resumen.ultimoCentro ?? null;
  const salud = buildVehicleHealthSummary(vehiculo.tipo_vehiculo, resumen, kmActual);

  return (
    <div className="app-bg-light min-h-screen text-zinc-900">
      <AppHeader variant="light" centered />

      <main className="space-y-4 px-4 pb-28 pt-2">
        <VehicleHealthDashboard salud={salud} tituloVehiculo={titulo} />

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

        {!resumen.vinculado && puedeRegistrarMantenimiento && (
          <MantenimientoB2cForm
            vehiculoId={vehiculo.id}
            unidadOdometro={vehiculo.unidad_odometro}
          />
        )}

        {!resumen.vinculado && !puedeRegistrarMantenimiento && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-zinc-500">
              Activa SmartTaller Pro para registrar mantenimientos y usar Chat Smartaller.
            </p>
          </div>
        )}
      </main>

      <AppVehicleFooter
        titulo={titulo}
        placa={vehiculo.placa}
        tipoVehiculo={vehiculo.tipo_vehiculo}
        chatHref={`/app/vehiculos/${vehiculo.id}/chat`}
      />
    </div>
  );
}
