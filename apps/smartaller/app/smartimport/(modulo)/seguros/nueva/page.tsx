import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { SeguroFichaForm } from "@/components/nfc/SeguroFichaForm";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: { expediente?: string } };

export default async function NuevaFichaSeguroPage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) {
    redirect("/smartimport/login?redirectTo=/smartimport/seguros/nueva");
  }
  const expediente = searchParams.expediente?.trim() || "";
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={
              expediente
                ? `/smartimport/seguros?expediente=${encodeURIComponent(expediente)}`
                : "/smartimport/seguros"
            }
            className="inline-flex rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <Shield className="h-3.5 w-3.5" />
              Por completar seguro
            </p>
            <h1 className="text-xl font-semibold text-zinc-50">Nueva ficha</h1>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <SeguroFichaForm
            submitLabel="Crear ficha"
            afterCreateHref={(id) =>
              expediente
                ? `/smartimport/seguros/${id}?expediente=${encodeURIComponent(expediente)}`
                : `/smartimport/seguros/${id}`
            }
          />
        </div>
      </div>
    </main>
  );
}
