import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import { PropietarioFichaForm } from "@/components/nfc/PropietarioFichaForm";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: { expediente?: string };
};

export default async function NuevaFichaPropietarioPage({
  searchParams,
}: Props) {
  const user = await getUser();
  if (!user) {
    redirect("/smartimport/login?redirectTo=/smartimport/propietarios/nueva");
  }

  const expediente = searchParams.expediente?.trim() || "";

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={
              expediente
                ? `/smartimport/propietarios?expediente=${encodeURIComponent(expediente)}`
                : "/smartimport/propietarios"
            }
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <UserRound className="h-3.5 w-3.5" />
              Por completar propietario
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              Nueva ficha
            </h1>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <PropietarioFichaForm
            submitLabel="Crear ficha"
            afterCreateHref={(id) =>
              expediente
                ? `/smartimport/propietarios/${id}?expediente=${encodeURIComponent(expediente)}`
                : `/smartimport/propietarios/${id}`
            }
          />
        </div>
      </div>
    </main>
  );
}
