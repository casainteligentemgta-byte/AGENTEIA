import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Car } from "lucide-react";
import {
  asignarExpedienteMatriculaAction,
  getMatriculaFichaAction,
  listExpedientesMatriculaAction,
} from "@/app/actions/nfc/matriculas";
import { FichaAsignarExpediente } from "@/components/nfc/FichaAsignarExpediente";
import { MatriculaFichaForm } from "@/components/nfc/MatriculaFichaForm";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
  searchParams: { expediente?: string };
};

export default async function FichaMatriculaPage({
  params,
  searchParams,
}: Props) {
  const user = await getUser();
  if (!user) {
    redirect(
      `/smartimport/login?redirectTo=/smartimport/matriculas/${params.id}`
    );
  }
  const result = await getMatriculaFichaAction(params.id);
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
  const listed = await listExpedientesMatriculaAction({ fichaId: params.id });
  const f = result.ficha;
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/smartimport/matriculas"
            className="inline-flex rounded-full p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-400/90">
              <Car className="h-3.5 w-3.5" />
              Ficha de matrícula
            </p>
            <h1 className="text-xl font-semibold text-zinc-50">
              {f.placa || "Sin placa"}
            </h1>
          </div>
        </div>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <MatriculaFichaForm
            initial={{
              id: f.id,
              placa: f.placa ?? "",
              oficinaIntt: f.oficinaIntt ?? "",
              fechaTramite: f.fechaTramite ?? "",
              requiereHomologacion: f.requiereHomologacion,
              observaciones: f.observaciones ?? "",
            }}
          />
        </section>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
          <FichaAsignarExpediente
            fichaId={f.id}
            expedientes={listed.success ? listed.expedientes : []}
            preselectVehiculoId={searchParams.expediente?.trim() || null}
            assignAction={asignarExpedienteMatriculaAction}
          />
        </div>
      </div>
    </main>
  );
}
