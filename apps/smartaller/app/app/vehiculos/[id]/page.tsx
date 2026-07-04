import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { OdometerCard } from "@/components/app/odometer-card";
import { MaintenanceModuleCard } from "@/components/app/maintenance-module-card";
import { WheelsGrid } from "@/components/app/wheels-grid";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { getEtiquetaVehiculo, getSubtituloVehiculo } from "@/lib/vehicles/format";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { id: string };
};

export default async function VehiculoDetallePage({ params }: PageProps) {
  const { id } = params;
  const vehiculo = await getUserVehiculoById(id);

  if (!vehiculo) notFound();

  const config = getConfigTipoVehiculo(vehiculo.tipo_vehiculo);
  const titulo = getEtiquetaVehiculo(vehiculo);
  const subtitulo = getSubtituloVehiculo(vehiculo);

  const modulosSinNeumaticos = config.modulos.filter((m) => m.id !== "neumaticos");
  const tieneNeumaticos = config.modulos.some((m) => m.id === "neumaticos");

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <AppHeader
        showBack
        backHref="/app"
        title={titulo}
        subtitle={subtitulo ?? config.label}
      />

      <main className="space-y-4 px-4 pb-24 pt-4">
        <OdometerCard vehiculo={vehiculo} />

        {tieneNeumaticos && <WheelsGrid config={config} />}

        {modulosSinNeumaticos.map((modulo) => (
          <MaintenanceModuleCard key={modulo.id} modulo={modulo} visitasRegistradas={0} />
        ))}

        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <p className="text-2xl font-light text-zinc-300">Próximamente</p>
          <p className="mt-2 text-sm text-zinc-500">Chat con tu taller y estadísticas avanzadas</p>
        </div>
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
