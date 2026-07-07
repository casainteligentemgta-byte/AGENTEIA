import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProtocoloTaller } from "@/components/smartbike/ProtocoloTaller";
import { getBikeWithComponents } from "@/lib/data/smartbike";
import { resolveBikeId } from "@/lib/smartbike/link-vehiculo";
import { createClient } from "@/lib/supabase/server";
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
    return (
      <div className="p-4 sm:p-8">
        <h1 className="text-2xl font-bold text-zinc-100">SmartBike — Protocolo taller</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          Abre esta página con{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-brand-400">
            ?vehiculoId=UUID&amp;componentId=UUID
          </code>{" "}
          o{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-brand-400">
            ?bikeId=UUID&amp;componentId=UUID
          </code>{" "}
          cuando recibas una bicicleta en servicio. El formulario exige el checklist completo antes
          de resetear el contador del componente.
        </p>
      </div>
    );
  }

  const supabase = createClient();
  const resolvedBikeId = await resolveBikeId(supabase, identifier);
  if (!resolvedBikeId) notFound();

  const bike = await getBikeWithComponents(resolvedBikeId);
  if (!bike || !bike.shop_id || !bike.shop) notFound();

  const alertCandidates = componentsNeedingAlert(bike.components);
  const component =
    (componentId ? bike.components.find((c) => c.id === componentId) : undefined) ??
    alertCandidates[0] ??
    bike.components[0];

  if (!component) {
    return (
      <div className="p-4 sm:p-8">
        <p className="text-zinc-400">La bicicleta no tiene componentes registrados.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard
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
                href={`/dashboard/smartbike?bikeId=${bike.id}&componentId=${c.id}`}
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
