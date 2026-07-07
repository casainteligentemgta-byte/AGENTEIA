import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { AppTabs } from "@/components/app/app-tabs";
import { AlertasBanner } from "@/components/app/alertas-banner";
import {
  TimelineCategoriaChips,
  TimelineFiltroCategorias,
} from "@/components/app/timeline-filtro-categorias";
import { getAlertasUsuario } from "@/lib/data/alertas";
import { getTimelineUsuario } from "@/lib/data/timeline";
import { CATEGORIAS_VEHICULO, type CategoriaVehiculoId } from "@/lib/schemas/categoria-vehiculo";
import { etiquetaCategoria } from "@/lib/vehicles/inferir-categorias-evento";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: { categoria?: string };
};

function parseCategoriaFiltro(raw?: string): CategoriaVehiculoId | null {
  if (!raw) return null;
  const parsed = CATEGORIAS_VEHICULO.find((c) => c === raw);
  return parsed ?? null;
}

export default async function TimelinePage({ searchParams }: PageProps) {
  const categoriaFiltro = parseCategoriaFiltro(searchParams.categoria);
  const [eventos, alertas] = await Promise.all([
    getTimelineUsuario(categoriaFiltro),
    getAlertasUsuario(5),
  ]);

  const tituloFiltro = categoriaFiltro ? etiquetaCategoria(categoriaFiltro) : null;

  return (
    <>
      <AppHeader centered />

      <main className="px-4 pb-10 pt-2">
        <AlertasBanner alertas={alertas} />

        <div className="my-5">
          <AppTabs active="timeline" />
        </div>

        <TimelineFiltroCategorias activo={categoriaFiltro} />

        <div className="space-y-3 rounded-3xl bg-[#0f1a2e]/90 p-4 ring-1 ring-white/5">
          {eventos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-600/60 px-6 py-12 text-center">
              <p className="text-zinc-200">
                {tituloFiltro
                  ? `Sin eventos de ${tituloFiltro.toLowerCase()}`
                  : "Sin eventos en tu timeline"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                {tituloFiltro
                  ? "Prueba otro filtro o registra un mantenimiento con esa categoría."
                  : "Los mantenimientos de taller o los que registres manualmente aparecerán aquí."}
              </p>
              {tituloFiltro ? (
                <Link
                  href="/app/timeline"
                  className="app-cta-btn mt-6 inline-flex px-5 py-2.5 text-sm"
                >
                  Ver todos
                </Link>
              ) : (
                <Link
                  href="/app/vehiculos/nuevo"
                  className="app-cta-btn mt-6 inline-flex px-5 py-2.5 text-sm"
                >
                  Agregar vehículo
                </Link>
              )}
            </div>
          ) : (
            eventos.map((evento) => (
              <Link
                key={evento.id}
                href={`/app/vehiculos/${evento.vehiculoId}`}
                className="block rounded-2xl border border-white/5 bg-[#152238]/60 p-4 transition hover:border-brand-500/30 hover:bg-[#152238]"
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
                        : "bg-brand-500/15 text-brand-300"
                    }`}
                  >
                    {evento.origen === "taller" ? "Taller" : "Propio"}
                  </span>
                </div>

                <TimelineCategoriaChips categorias={evento.categorias} />

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
