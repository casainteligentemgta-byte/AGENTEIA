import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { OdometerCard } from "@/components/app/odometer-card";
import { MaintenanceModuleCard } from "@/components/app/maintenance-module-card";
import { VisitHistory } from "@/components/app/visit-history";
import { WheelsGrid } from "@/components/app/wheels-grid";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getResumenTallerVehiculo } from "@/lib/data/vehicle-history";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { getEtiquetaVehiculo, getSubtituloVehiculo } from "@/lib/vehicles/format";
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

  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  const titulo = getEtiquetaVehiculo(vehiculo);
  const subtitulo = getSubtituloVehiculo(vehiculo);

  const modulosSinNeumaticos = config.modulos.filter((m) => m.id !== "neumaticos");
  const tieneNeumaticos = config.modulos.some((m) => m.id === "neumaticos");

  const ultimoCentro = resumen.ultimoCentro
    ? `${resumen.ultimoCentro}${resumen.ultimaVisita ? ` (${resumen.ultimaVisita})` : ""}`
    : null;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <AppHeader
        showBack
        backHref="/app"
        title={titulo}
        subtitle={subtitulo ?? config.label}
      />

      <main className="space-y-4 px-4 pb-24 pt-4">
        <OdometerCard
          vehiculo={vehiculo}
          ultimaVisita={resumen.ultimaVisita}
          ultimoCentro={ultimoCentro}
        />

        {resumen.vinculado && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-xs font-medium text-emerald-800">
            Vinculado con tu taller · {resumen.totalVisitas} visita(s) registrada(s)
          </div>
        )}

        {tieneNeumaticos && <WheelsGrid config={config} />}

        {modulosSinNeumaticos.map((modulo) => (
          <MaintenanceModuleCard
            key={modulo.id}
            modulo={modulo}
            visitasRegistradas={resumen.totalVisitas}
            historial={resumen.mantenimientos}
          />
        ))}

        <VisitHistory
          mantenimientos={resumen.mantenimientos}
          proximoRecordatorio={resumen.proximoRecordatorio}
        />
      </main>

      <footer className="fixed bottom-0 left-0 right-0 mx-auto max-w-lg border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-700">{titulo}</p>
            <p className="truncate text-xs text-zinc-400">{vehiculo.placa}</p>
          </div>
          <Link
            href="/app"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg"
            aria-label="Asistente (próximamente)"
          >
            <MessageCircle className="h-5 w-5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
