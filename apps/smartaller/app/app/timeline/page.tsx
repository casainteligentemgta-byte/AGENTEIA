import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { AppTabs } from "@/components/app/app-tabs";
import { getTimelineUsuario } from "@/lib/data/timeline";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const eventos = await getTimelineUsuario();

  return (
    <>
      <AppHeader centered />

      <main className="px-4 pb-10 pt-2">
        <div className="my-5">
          <AppTabs active="timeline" />
        </div>

        <div className="space-y-3 rounded-3xl bg-[#0f1f38]/90 p-4 ring-1 ring-white/5">
          {eventos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-600/60 px-6 py-12 text-center">
              <p className="text-zinc-200">Sin eventos en tu timeline</p>
              <p className="mt-2 text-sm text-zinc-500">
                Los mantenimientos de taller o los que registres manualmente aparecerán aquí.
              </p>
              <Link
                href="/app/vehiculos/nuevo"
                className="app-cta-btn mt-6 inline-flex px-5 py-2.5 text-sm"
              >
                Agregar vehículo
              </Link>
            </div>
          ) : (
            eventos.map((evento) => (
              <Link
                key={evento.id}
                href={`/app/vehiculos/${evento.vehiculoId}`}
                className="block rounded-2xl border border-white/5 bg-[#1a3055]/60 p-4 transition hover:border-blue-500/30 hover:bg-[#1a3055]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {evento.descripcion}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {evento.vehiculoLabel} · {evento.placa}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      evento.origen === "taller"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-blue-500/15 text-blue-300"
                    }`}
                  >
                    {evento.origen === "taller" ? "Taller" : "Propio"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  <span>{formatDate(evento.fecha)}</span>
                  {evento.kilometraje != null && (
                    <span>{evento.kilometraje.toLocaleString("es-CO")} km</span>
                  )}
                  {evento.costo != null && (
                    <span className="text-zinc-300">{formatCurrency(Number(evento.costo))}</span>
                  )}
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
