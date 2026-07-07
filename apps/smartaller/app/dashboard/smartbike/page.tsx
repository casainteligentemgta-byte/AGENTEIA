import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bike } from "lucide-react";
import { ProtocoloTaller } from "@/components/smartbike/ProtocoloTaller";
import { getBikeWithComponents } from "@/lib/data/smartbike";
import { getVehiculos } from "@/lib/data/dashboard";
import { ensureTallerBikeReady } from "@/lib/smartbike/ensure-taller-bike";
import { componentsNeedingAlert } from "@/lib/smartbike/strava";
import { COMPONENT_TYPE_LABELS } from "@/lib/smartbike/types";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: { bikeId?: string; vehiculoId?: string; componentId?: string };
};

export default async function SmartBikeDashboardPage({ searchParams }: PageProps) {
  const { bikeId, vehiculoId, componentId } = searchParams;
  const identifier = bikeId ?? vehiculoId;

  if (!identifier) {
    const vehiculos = await getVehiculos();
    const bicicletas = vehiculos.filter((v) => v.tipo_vehiculo === "bicicleta");

    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-zinc-100">SmartBike — Protocolo taller</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          Selecciona una bicicleta de tu flota para ejecutar el protocolo de cierre y resetear
          contadores de componentes.
        </p>

        {bicicletas.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center text-sm text-zinc-500">
            No hay bicicletas registradas. Agrégalas en{" "}
            <Link href="/dashboard/vehiculos/nuevo" className="text-brand-400 hover:underline">
              Vehículos → Nuevo
            </Link>
            .
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bicicletas.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/dashboard/smartbike?vehiculoId=${v.id}`}
                  className="glass flex items-start gap-3 rounded-2xl p-4 transition hover:border-brand-600/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-brand-400">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">
                      {v.nick || `${v.marca ?? ""} ${v.modelo ?? ""}`.trim() || v.placa}
                    </p>
                    <p className="text-sm text-zinc-500">{v.placa}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const prepared = await ensureTallerBikeReady(identifier);
  if (!prepared.ok) {
    return (
      <div className="p-4 sm:p-8">
        <Link
          href="/dashboard/smartbike"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a bicicletas
        </Link>
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {prepared.error}
        </p>
      </div>
    );
  }

  const bike = await getBikeWithComponents(prepared.bikeId);
  if (!bike || !bike.shop_id || !bike.shop) notFound();

  const alertCandidates = componentsNeedingAlert(bike.components);
  const component =
    (componentId ? bike.components.find((c) => c.id === componentId) : undefined) ??
    alertCandidates[0] ??
    bike.components[0];

  if (!component) {
    return (
      <div className="p-4 sm:p-8">
        <Link
          href="/dashboard/smartbike"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a bicicletas
        </Link>
        <p className="text-zinc-400">La bicicleta no tiene componentes registrados.</p>
      </div>
    );
  }

  const queryBikeId = bikeId ?? prepared.bikeId;

  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/dashboard/smartbike"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        SmartBike
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-zinc-100">
        {bike.brand} {bike.model}
      </h1>
      <p className="mb-6 text-sm text-zinc-500">
        Serie {bike.frame_serial} · {bike.shop.name}
      </p>

      {bike.components.length > 1 && (
        <ul className="mb-6 flex flex-wrap gap-2">
          {bike.components.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/smartbike?bikeId=${queryBikeId}&componentId=${c.id}`}
                className={
                  c.id === component.id
                    ? "rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
                }
              >
                {COMPONENT_TYPE_LABELS[c.component_type]}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="max-w-xl">
        <ProtocoloTaller bikeId={bike.id} shopId={bike.shop_id} component={component} />
      </div>
    </div>
  );
}
