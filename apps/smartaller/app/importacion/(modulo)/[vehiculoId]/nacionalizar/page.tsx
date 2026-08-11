import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPuertoLibreFicha } from "@/app/actions/nfc/importacion-vehiculo";
import { PuertoLibreNacionalizarWizard } from "@/components/nfc/PuertoLibreNacionalizarWizard";
import { getRegimenConfig, labelRegimenImportacion } from "@/lib/importacion/regimenes";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { vehiculoId: string };
};

export default async function PuertoLibreNacionalizarPage({ params }: Props) {
  const user = await getUser();
  if (!user) {
    redirect(`/login?next=/importacion/${params.vehiculoId}/nacionalizar`);
  }

  const result = await getPuertoLibreFicha(params.vehiculoId);
  if (!result.success) {
    if (result.error === "Vehículo no encontrado") notFound();
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {result.error}
        </div>
      </main>
    );
  }

  const { ficha } = result;
  const fase = ficha.importacion.planillaFase ?? 0;
  const regimenCfg = getRegimenConfig(ficha.importacion.regimen);

  if (!regimenCfg.nacionalizacionPuertoLibre) {
    return (
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-4 text-sm text-amber-100">
            El wizard de nacionalización (cambio de régimen / permanencia) aplica
            solo a Puerto Libre. Este expediente está en{" "}
            {labelRegimenImportacion(ficha.importacion.regimen)}.
          </div>
          <Link
            href={`/importacion/${ficha.id}`}
            className="inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Volver al expediente
          </Link>
        </div>
      </main>
    );
  }

  if (fase < 8) {
    return (
      <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 px-4 py-4 text-sm text-amber-100">
            Primero completa la planilla hasta la matriculación y la placa. Luego
            podrás nacionalizar.
          </div>
          <Link
            href={`/importacion/${ficha.id}/planilla`}
            className="inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Ir a la planilla
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.08),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <PuertoLibreNacionalizarWizard ficha={ficha} />
      </div>
    </main>
  );
}
