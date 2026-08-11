import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { listImportadoresAction } from "@/app/actions/nfc/importadores";
import { RegistrarImportacionWizard } from "@/components/nfc/RegistrarImportacionWizard";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function NuevaImportacionPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/importacion/importaciones/nueva");

  const { taller, error } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {error ?? "No se pudo cargar tu taller."}
        </div>
      </main>
    );
  }

  const listed = await listImportadoresAction({ soloActivos: true });
  const importadores = listed.success ? listed.importadores : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/importacion"
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Nueva importación
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Primero el cliente importador, luego los datos del vehículo y el
              régimen.
            </p>
          </div>
        </div>

        <Link
          href="/importacion/carga-masiva"
          className="mb-5 inline-flex w-full flex-col items-center justify-center gap-1 rounded-2xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3 text-center transition hover:border-cyan-500/50"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
            <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
            Carga masiva — hoja anexa / varios VIN
          </span>
          <span className="text-xs text-cyan-200/70">
            MAV TRADE u otras facturas con N vehículos → N expedientes
          </span>
        </Link>

        {!listed.success ? (
          <p className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            {listed.error}. Puedes crear un cliente nuevo a continuación.
          </p>
        ) : null}

        <RegistrarImportacionWizard initialImportadores={importadores} />
      </div>
    </main>
  );
}
