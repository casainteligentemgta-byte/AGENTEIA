import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listImportadoresAction } from "@/app/actions/nfc/importadores";
import { RegistrarImportacionWizard } from "@/components/nfc/RegistrarImportacionWizard";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function NuevaImportacionPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/smartimport/importaciones/nueva");

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
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/smartimport"
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
            Nueva importación
          </h1>
        </div>

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
