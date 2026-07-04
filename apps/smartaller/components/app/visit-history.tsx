import { CalendarClock, Wrench } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { MantenimientoHistorial } from "@/lib/data/vehicle-history";

type VisitHistoryProps = {
  mantenimientos: MantenimientoHistorial[];
  proximoRecordatorio?: {
    fecha_programada: string;
    kilometraje_objetivo: number | null;
  } | null;
};

export function VisitHistory({ mantenimientos, proximoRecordatorio }: VisitHistoryProps) {
  if (mantenimientos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-8 text-center">
        <Wrench className="mx-auto h-8 w-8 text-zinc-300" />
        <p className="mt-3 text-sm font-medium text-zinc-600">Sin visitas al taller aún</p>
        <p className="mt-1 text-xs text-zinc-400">
          Cuando tu taller registre un servicio con esta placa, aparecerá aquí automáticamente
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-800">Historial del taller</h2>
        <span className="text-xs text-zinc-400">{mantenimientos.length} visita(s)</span>
      </div>

      {proximoRecordatorio && (
        <div className="flex items-start gap-3 border-b border-blue-50 bg-blue-50/50 px-4 py-3">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-xs font-medium text-blue-800">Próximo servicio</p>
            <p className="text-sm text-blue-700">
              {formatDate(proximoRecordatorio.fecha_programada)}
              {proximoRecordatorio.kilometraje_objetivo != null &&
                ` · ${proximoRecordatorio.kilometraje_objetivo.toLocaleString("es-CO")} km`}
            </p>
          </div>
        </div>
      )}

      <ul className="divide-y divide-zinc-100">
        {mantenimientos.slice(0, 5).map((m) => (
          <li key={m.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-800">
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
