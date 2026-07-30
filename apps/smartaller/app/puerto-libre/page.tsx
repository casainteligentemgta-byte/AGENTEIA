import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Car, ChevronRight, Plus, Upload } from "lucide-react";
import {
  listPuertoLibreVehiculos,
  type PuertoLibreVehiculoListItem,
} from "@/app/actions/nfc/puerto-libre-vehiculo";
import { PuertoLibreDashboardEyebrow } from "@/components/nfc/PuertoLibreDashboardEyebrow";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";

export const dynamic = "force-dynamic";

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

/** Ej. "23 marzo 09:30" */
function formatFechaHoraCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dia = d.getDate();
  const mes = MESES_ES[d.getMonth()] ?? "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dia} ${mes} ${hh}:${mm}`;
}

function labelExpediente(v: PuertoLibreVehiculoListItem): string {
  return v.codigoExpediente ?? v.placa;
}

function esPendienteCompletar(v: PuertoLibreVehiculoListItem): boolean {
  return v.planillaFase == null || v.planillaFase < 4;
}

export default async function PuertoLibrePage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/puerto-libre");

  const { taller, error: tallerError } = await ensureTallerForUser(user.id);
  if (!taller) {
    return (
      <PuertoLibreShell>
        <div className="rounded-2xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {tallerError ?? "No se pudo cargar tu taller."}
        </div>
      </PuertoLibreShell>
    );
  }

  const list = await listPuertoLibreVehiculos();
  const vehiculos = list.success ? list.vehiculos : [];
  const pendientes = vehiculos.filter(esPendienteCompletar);
  const docsFaltantes = vehiculos.filter((v) => v.docsFaltantes > 0);

  return (
    <PuertoLibreShell>
      <header className="mb-5 space-y-4">
        <div>
          <PuertoLibreDashboardEyebrow />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Puerto Libre NFC
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-400">
            Transferencia de carga básica, el sistema es automático y captura datos NFC
          </p>
        </div>
        <Link
          href="/puerto-libre/vehiculos/nuevo"
          className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(8,145,178,0.28)] transition hover:bg-cyan-500"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          Registrar vehículo
        </Link>
      </header>

      {!list.success ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {list.error}. Si acabas de instalar el módulo, ejecuta también{" "}
          <code className="text-red-100">20260728_puerto_libre_importacion.sql</code>.
        </div>
      ) : vehiculos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-14 text-center">
          <Car className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-zinc-300">No hay vehículos registrados</p>
          <p className="mt-1 text-sm text-zinc-500">
            Registra un vehículo para armar su expediente Puerto Libre.
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-200">
              Pendiente a completar
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay expedientes pendientes.</p>
            ) : (
              <ul className="divide-y divide-zinc-800/80 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                {pendientes.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/puerto-libre/${v.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-zinc-900/60"
                    >
                      <span className="font-mono text-sm font-semibold tracking-wide text-zinc-100">
                        {labelExpediente(v)}
                      </span>
                      <span className="shrink-0 text-sm text-zinc-400">
                        {formatFechaHoraCorta(v.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-200">
              Documentación Faltante
            </h2>
            {docsFaltantes.length === 0 ? (
              <p className="text-sm text-zinc-500">Toda la documentación está al día.</p>
            ) : (
              <ul className="divide-y divide-zinc-800/80 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                {docsFaltantes.map((v) => (
                  <li key={v.id}>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <Link
                        href={`/puerto-libre/${v.id}`}
                        className="min-w-0 font-mono text-sm font-semibold tracking-wide text-zinc-100 hover:text-cyan-300"
                      >
                        {labelExpediente(v)}
                      </Link>
                      <Link
                        href={`/puerto-libre/${v.id}?edit=1`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-700/50 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:border-cyan-500/60 hover:bg-cyan-900/40"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Subir documentación
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Todos ({vehiculos.length})
            </h2>
            <ul className="space-y-1">
              {vehiculos.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/puerto-libre/${v.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-zinc-900/50"
                  >
                    <span className="font-mono font-medium text-zinc-300">
                      {labelExpediente(v)}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PuertoLibreShell>
  );
}

function PuertoLibreShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg sm:max-w-xl">
        {children}
      </div>
    </main>
  );
}
