import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Car, ChevronRight, FileText, Nfc, Plus, ShieldCheck } from "lucide-react";
import { listPuertoLibreVehiculos } from "@/app/actions/nfc/puerto-libre-vehiculo";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

  return (
    <PuertoLibreShell>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-cyan-400">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Dashboard</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
            Puerto Libre NFC
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Vehículos registrados: expediente de importación, documentos, propietario y sticker NFC.
          </p>
          <p className="mt-1 text-xs text-zinc-600">{taller.nombre}</p>
        </div>
        <Link
          href="/dashboard/vehiculos/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" />
          Registrar vehículo
        </Link>
      </div>

      {!list.success ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {list.error}. Si acabas de instalar el módulo, ejecuta también{" "}
          <code className="text-red-100">20260728_puerto_libre_importacion.sql</code>.
        </div>
      ) : list.vehiculos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-16 text-center">
          <Car className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-zinc-300">No hay vehículos registrados</p>
          <p className="mt-1 text-sm text-zinc-500">
            Registra un vehículo para armar su expediente Puerto Libre.
          </p>
          <Link
            href="/dashboard/vehiculos/nuevo"
            className="mt-6 inline-flex rounded-xl bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Registrar primer vehículo
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.vehiculos.map((v) => (
            <li key={v.id}>
              <Link
                href={`/puerto-libre/${v.id}`}
                className="group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition hover:border-cyan-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-bold tracking-wide text-cyan-400">
                      {v.placa}
                    </p>
                    <p className="mt-1 truncate text-zinc-300">
                      {v.nombre_cliente ?? "Sin propietario"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {[v.marca, v.modelo, v.color].filter(Boolean).join(" · ") || "Sin ficha"}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600 transition group-hover:text-cyan-400" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge
                    ok={v.docsCount > 0}
                    icon={<FileText className="h-3 w-3" />}
                    label={`${v.docsCount} docs`}
                  />
                  <Badge
                    ok={v.tienePin}
                    icon={<ShieldCheck className="h-3 w-3" />}
                    label={v.tienePin ? "PIN" : "Sin PIN"}
                  />
                  <Badge
                    ok={Boolean(v.stickerToken)}
                    icon={<Nfc className="h-3 w-3" />}
                    label={v.stickerToken ? "NFC" : "Sin NFC"}
                  />
                </div>

                <div className="mt-auto space-y-1 pt-4 text-xs text-zinc-500">
                  {v.regimen ? <p>Régimen: {v.regimen}</p> : <p>Sin datos de importación</p>}
                  <p>Registrado: {formatDate(v.created_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PuertoLibreShell>
  );
}

function Badge({
  ok,
  icon,
  label,
}: {
  ok: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${
        ok ? "bg-cyan-500/10 text-cyan-300" : "bg-zinc-800 text-zinc-500"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}

function PuertoLibreShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.12),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-8 flex items-center justify-between text-sm">
          <Link href="/dashboard" className="text-zinc-500 transition hover:text-zinc-300">
            ← Dashboard
          </Link>
          <Link href="/" className="text-zinc-500 transition hover:text-zinc-300">
            SmartTaller
          </Link>
        </nav>
        {children}
      </div>
    </main>
  );
}
