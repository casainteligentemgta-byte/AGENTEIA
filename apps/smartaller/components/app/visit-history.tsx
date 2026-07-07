import type { MantenimientoHistorial } from "@/lib/data/vehicle-history";
import { parseMediaFromDetalle } from "@/lib/schemas/diagnostico-media";
import { formatDate } from "@/lib/utils";
import { DiagnosticoGaleria, DiagnosticoMediaBadge } from "@/components/app/diagnostico-galeria";
import { CalendarClock, Wrench } from "lucide-react";

type VisitHistoryProps = {
  mantenimientos: MantenimientoHistorial[];
  proximoRecordatorio?: {
    fecha_programada: string;
    kilometraje_objetivo: number | null;
  } | null;
};

export function VisitHistory({ mantenimientos, proximoRecordatorio }: VisitHistoryProps) {
  if (mantenimientos.length === 0) return null;

  return (
    <div className="app-card-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-bold text-zinc-800">Historial transparente</h2>
        <span className="text-xs text-zinc-400">{mantenimientos.length} evento(s)</span>
      </div>

      {proximoRecordatorio && (
        <div className="flex items-start gap-3 border-b border-blue-50 bg-blue-50/60 px-4 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-xs font-semibold text-blue-800">Próximo servicio</p>
            <p className="text-sm text-blue-700">
              {formatDate(proximoRecordatorio.fecha_programada)}
              {proximoRecordatorio.kilometraje_objetivo != null &&
                ` · ${proximoRecordatorio.kilometraje_objetivo.toLocaleString("es-CO")} km`}
            </p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-zinc-100">
        {mantenimientos.slice(0, 8).map((m) => {
          const media = parseMediaFromDetalle(m.detalle_revision);

          return (
            <li key={m.id} className="px-4 py-4">
              <div className="flex gap-3">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-800">
                      {m.descripcion ?? m.descripcion_servicio ?? "Servicio registrado"}
                    </p>
                    <DiagnosticoMediaBadge count={media.length} />
                  </div>
                  {m.taller_nombre && (
                    <p className="truncate text-xs text-zinc-500">{m.taller_nombre}</p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {formatDate(m.created_at)}
                    {m.kilometraje != null &&
                      ` · ${m.kilometraje.toLocaleString("es-CO")} km`}
                  </p>
                </div>
              </div>

              {media.length > 0 && (
                <div className="mt-3 pl-7">
                  <DiagnosticoGaleria media={media} compact titulo="Evidencia del taller" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
