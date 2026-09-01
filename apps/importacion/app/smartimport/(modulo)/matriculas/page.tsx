import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Car, Plus } from "lucide-react";
import { listMatriculasAction } from "@/app/actions/nfc/matriculas";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

type Props = { searchParams: { expediente?: string } };

export default async function MatriculasPage({ searchParams }: Props) {
  const user = await getUser();
  if (!user) redirect("/smartimport/login?redirectTo=/smartimport/matriculas");
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
  const listed = await listMatriculasAction();
  const fichas = listed.success ? listed.fichas : [];
  const expediente = searchParams.expediente?.trim() || "";
  const nuevaHref = expediente
    ? `/smartimport/matriculas/nueva?expediente=${encodeURIComponent(expediente)}`
    : "/smartimport/matriculas/nueva";

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/smartimport#cola-matricula"
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <Car className="h-3.5 w-3.5" />
              Por completar matrícula
            </p>
            <h1 className="text-xl font-semibold text-zinc-50">
              Fichas de matrícula
            </h1>
          </div>
          <Link
            href={nuevaHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Nueva
          </Link>
        </div>
        {expediente ? (
          <p className="mb-4 rounded-xl border border-cyan-900/40 bg-cyan-950/20 px-3 py-2 text-sm text-cyan-100">
            Elige una ficha para asignarle el expediente, o crea una nueva.
          </p>
        ) : null}
        {!listed.success ? (
          <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {listed.error}
          </p>
        ) : fichas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 px-6 py-12 text-center text-zinc-400">
            No hay fichas de matrícula.
            <div className="mt-4">
              <Link
                href={nuevaHref}
                className="inline-flex rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                Nueva ficha
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {fichas.map((f) => {
              const href = expediente
                ? `/smartimport/matriculas/${f.id}?expediente=${encodeURIComponent(expediente)}`
                : `/smartimport/matriculas/${f.id}`;
              return (
                <li key={f.id}>
                  <Link
                    href={href}
                    className="block rounded-2xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 hover:border-cyan-700/40"
                  >
                    <p className="text-sm font-semibold text-zinc-50">
                      {f.placa || "Sin placa"}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {f.oficinaIntt || "Sin oficina INTT"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {f.expedientesCount} expediente
                      {f.expedientesCount === 1 ? "" : "s"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
