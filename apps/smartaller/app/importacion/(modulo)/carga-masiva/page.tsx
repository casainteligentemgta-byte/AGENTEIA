import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listImportadoresAction } from "@/app/actions/nfc/importadores";
import { PuertoLibreCargaMasiva } from "@/components/nfc/PuertoLibreCargaMasiva";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";
/** OCR multi-VIN (Chery 18 filas) puede necesitar varias pasadas de visión. */
export const maxDuration = 300;

export default async function CargaMasivaPuertoLibrePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/importacion/carga-masiva");

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
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/importacion"
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">
              Carga masiva de vehículos
            </h1>
            <p className="mt-0.5 text-sm text-zinc-400">
              Factura + certificados → se crean expedientes con VIN; el semáforo
              (rojo/ámbar/verde) indica qué falta completar después
            </p>
          </div>
        </div>

        <PuertoLibreCargaMasiva
          initialImportadores={importadores}
          tallerId={taller.id}
        />
      </div>
    </main>
  );
}
