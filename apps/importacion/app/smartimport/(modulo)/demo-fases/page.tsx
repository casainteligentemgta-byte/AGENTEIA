import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LayoutList } from "lucide-react";
import { ensureDemoFasesAction } from "@/app/actions/nfc/demo-fases";
import { porCompletarEtapaTitle } from "@/lib/importacion/dashboard-completar-etapa";
import {
  hrefDashboardCola,
  IMPORTACION_BASE,
  SMARTIMPORT_DEMO_FASES_PATH,
} from "@/lib/importacion/paths";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default async function DemoFasesPage() {
  const user = await getUser();
  if (!user) {
    redirect(
      `${IMPORTACION_BASE}/login?redirectTo=${SMARTIMPORT_DEMO_FASES_PATH}`
    );
  }

  const { taller, error: tallerError } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {tallerError ?? "No se pudo cargar tu taller."}
        </div>
      </main>
    );
  }

  const ensured = await ensureDemoFasesAction();
  if (!ensured.success) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {ensured.error}
        </div>
      </main>
    );
  }

  const aviso =
    ensured.created > 0
      ? `Se crearon ${ensured.created} expedientes de prueba.`
      : "Los 8 expedientes de prueba ya estaban; se reubicaron en su cola.";

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link
          href={IMPORTACION_BASE}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-zinc-50">
            <LayoutList className="h-5 w-5 text-cyan-400" />
            Un expediente por fase
          </h1>
          <p className="text-sm text-zinc-400">
            {aviso} Cada Hilux queda en una cola distinta para revisar el
            dashboard.
          </p>
        </header>
        <ul className="space-y-2">
          {ensured.vehiculos.map((v) => (
            <li
              key={v.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3"
            >
              <p className="font-medium text-zinc-100">
                Fase {v.fase} · {porCompletarEtapaTitle(v.fase)}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {v.codigoExpediente ?? "sin código"} · {v.color}
                {v.numeroBl ? ` · BL ${v.numeroBl}` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`${IMPORTACION_BASE}/${v.id}/planilla?fase=${v.fase}`}
                  className="inline-flex items-center rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Abrir planilla
                </Link>
                <Link
                  href={hrefDashboardCola(v.fase)}
                  className="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:border-cyan-500/40 hover:text-cyan-100"
                >
                  Ver cola
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <Link
          href={IMPORTACION_BASE}
          className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Ir al dashboard
        </Link>
      </div>
    </main>
  );
}
