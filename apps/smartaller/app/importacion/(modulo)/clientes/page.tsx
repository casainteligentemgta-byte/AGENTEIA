import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { listImportadoresAction } from "@/app/actions/nfc/importadores";
import { ImportadoresClientesPanel } from "@/components/nfc/ImportadoresClientesPanel";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function ImportacionClientesPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/importacion/clientes");

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

  const listed = await listImportadoresAction({ soloActivos: false });
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
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <Users className="h-3.5 w-3.5" />
              Clientes
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Importadores
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Personas naturales o jurídicas. Son el primer paso al registrar una
              importación.
            </p>
          </div>
        </div>

        {!listed.success ? (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {listed.error}
          </p>
        ) : (
          <ImportadoresClientesPanel initialImportadores={importadores} />
        )}
      </div>
    </main>
  );
}
