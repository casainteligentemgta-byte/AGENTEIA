import type { MantenimientoHistorial } from "@/lib/data/vehicle-history";
import { formatDate } from "@/lib/utils";
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
        <h2 className="text-sm font-bold text-zinc-800">Timeline</h2>
        <span className="text-xs text-zinc-400">{mantenimientos.length} evento(s)</span>
      </div>

      {proximoRecordatorio && (
        <div className="flex items-start gap-3 border-b border-brand-50 bg-brand-50/60 px-4 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div>
            <p className="text-xs font-semibold text-brand-800">Próximo servicio</p>
            <p className="text-sm text-brand-700">
              {formatDate(proximoRecordatorio.fecha_programada)}
              {proximoRecordatorio.kilometraje_objetivo != null &&
                ` · ${proximoRecordatorio.kilometraje_objetivo.toLocaleString("es-CO")} km`}
            </p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-zinc-100">
        {mantenimientos.slice(0, 5).map((m) => (
          <li key={m.id} className="flex gap-3 px-4 py-3">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-800">
                {m.descripcion ?? m.descripcion_servicio ?? "Servicio registrado"}
              </p>
              {m.taller_nombre && (
                <p className="truncate text-xs text-zinc-500">{m.taller_nombre}</p>
              )}
            </div>
            <div className="shrink-0 text-right text-xs text-zinc-400">
              <p>{formatDate(m.created_at)}</p>
              {m.kilometraje != null && (
                <p>{m.kilometraje.toLocaleString("es-CO")} km</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
