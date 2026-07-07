import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import type { AlertaRecordatorio } from "@/lib/data/alertas";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type AlertasBannerProps = {
  alertas: AlertaRecordatorio[];
};

function mensajeAlerta(alerta: AlertaRecordatorio): string {
  if (alerta.prioridad === "critico") {
    const dias = Math.abs(alerta.diasRestantes);
    return dias === 0
      ? "Servicio vencido hoy"
      : `Servicio vencido hace ${dias} día(s)`;
  }
  if (alerta.diasRestantes === 0) {
    return "Servicio programado para hoy";
  }
  return `Servicio en ${alerta.diasRestantes} día(s)`;
}

export function AlertasBanner({ alertas }: AlertasBannerProps) {
  if (alertas.length === 0) return null;

  const criticas = alertas.filter((a) => a.prioridad === "critico").length;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 to-[#152238]/80 ring-1 ring-amber-500/10">
      <div className="flex items-center gap-2 border-b border-amber-500/15 px-4 py-2.5">
        <AlertTriangle
          className={cn(
            "h-4 w-4 shrink-0",
            criticas > 0 ? "text-red-400" : "text-amber-400"
          )}
        />
        <h2 className="text-sm font-bold text-white">Alertas de mantenimiento</h2>
        <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
          {alertas.length}
        </span>
      </div>

      <ul className="divide-y divide-white/5">
        {alertas.slice(0, 5).map((alerta) => (
          <li key={alerta.id}>
            <Link
              href={`/app/vehiculos/${alerta.vehiculoId}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  alerta.prioridad === "critico" ? "bg-red-500" : "bg-amber-500"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {alerta.vehiculoLabel}{" "}
                  <span className="font-normal text-zinc-400">· {alerta.placa}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  {formatDate(alerta.fecha_programada)}
                  {alerta.kilometraje_objetivo != null && (
                    <span>· {alerta.kilometraje_objetivo.toLocaleString("es-CO")} km</span>
                  )}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs font-medium",
                    alerta.prioridad === "critico" ? "text-red-300" : "text-amber-300"
                  )}
                >
                  {mensajeAlerta(alerta)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
