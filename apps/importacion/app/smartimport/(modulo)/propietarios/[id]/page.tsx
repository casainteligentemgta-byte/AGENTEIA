import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";
import {
  getPropietarioAction,
  listExpedientesAsignablesAction,
} from "@/app/actions/nfc/propietarios";
import { PropietarioAsignarExpediente } from "@/components/nfc/PropietarioAsignarExpediente";
import { PropietarioFichaForm } from "@/components/nfc/PropietarioFichaForm";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
  searchParams: { expediente?: string };
};

export default async function FichaPropietarioPage({
  params,
  searchParams,
}: Props) {
  const user = await getUser();
  if (!user) {
    redirect(
      `/smartimport/login?redirectTo=/smartimport/propietarios/${params.id}`
    );
  }

  const result = await getPropietarioAction(params.id);
  if (!result.success) {
    if (result.error === "Ficha no encontrada") notFound();
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {result.error}
        </div>
      </main>
    );
  }

  const listed = await listExpedientesAsignablesAction({
    propietarioId: params.id,
  });
  const expedientes = listed.success ? listed.expedientes : [];
  const p = result.propietario;
  const preselect = searchParams.expediente?.trim() || null;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/smartimport/propietarios"
            className="inline-flex shrink-0 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <UserRound className="h-3.5 w-3.5" />
              Ficha de propietario
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              {p.nombre}
            </h1>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Datos</h2>
          <PropietarioFichaForm
            initial={{
              id: p.id,
              nombre: p.nombre,
              cedula: p.cedula ?? "",
              telefono: p.telefono ?? "",
              email: p.email ?? "",
              fechaNacimiento: p.fechaNacimiento ?? "",
              direccion: p.direccion ?? "",
            }}
          />
        </section>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <PropietarioAsignarExpediente
            propietarioId={p.id}
            expedientes={expedientes}
            preselectVehiculoId={preselect}
          />
        </div>
      </div>
    </main>
  );
}
