import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatKilometraje,
  getDescripcion,
} from "@/lib/format";
import type { Mantenimiento, PresidenciaStats, RecordatorioConPlaca } from "@/lib/types";

type Props = {
  stats: PresidenciaStats;
  mantenimientos: Mantenimiento[];
  recordatorios: RecordatorioConPlaca[];
  tallerNombre: string;
};

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className={`mt-2 text-4xl font-bold tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    pendiente: "bg-amber-500/20 text-amber-300",
    enviado: "bg-blue-500/20 text-blue-300",
    completado: "bg-emerald-500/20 text-emerald-300",
    cancelado: "bg-zinc-700 text-zinc-400",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[estado] ?? styles.pendiente}`}
    >
      {estado}
    </span>
  );
}

export function PresidenciaDashboard({ stats, mantenimientos, recordatorios, tallerNombre }: Props) {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-400">Panel de recepción</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 lg:text-4xl">{tallerNombre}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Servicios vía Telegram · actualización automática cada 30 s
          </p>
        </div>
        <p className="text-sm text-zinc-600">
          {new Date().toLocaleString("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Servicios hoy" value={stats.serviciosHoy} accent="text-blue-400" />
        <StatCard label="Servicios este mes" value={stats.serviciosMes} accent="text-zinc-100" />
        <StatCard label="Vehículos registrados" value={stats.vehiculosRegistrados} accent="text-zinc-100" />
        <StatCard label="Recordatorios pendientes" value={stats.recordatoriosPendientes} accent="text-amber-400" />
      </section>

      <div className="grid gap-8 xl:grid-cols-5">
        <section className="xl:col-span-3">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Últimos servicios</h2>
          <div className="glass overflow-hidden rounded-2xl">
            {mantenimientos.length === 0 ? (
              <p className="p-10 text-center text-sm text-zinc-500">
                Aún no hay servicios. Los mecánicos registran facturas por Telegram.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Placa</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-500">Servicio</th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mantenimientos.map((m) => (
                      <tr key={m.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-lg font-bold text-blue-400">
                          {m.placa ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{m.nombre_cliente ?? "—"}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-zinc-400">
                          {getDescripcion(m)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-zinc-100">
                          {formatCurrency(m.costo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="xl:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Próximos servicios</h2>
          <div className="space-y-3">
            {recordatorios.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-center text-sm text-zinc-500">
                No hay recordatorios programados.
              </div>
            ) : (
              recordatorios.map((r) => (
                <article key={r.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xl font-bold text-zinc-100">{r.placa}</p>
                      <p className="text-sm text-zinc-400">{r.nombre_cliente ?? "Cliente sin nombre"}</p>
                    </div>
                    <EstadoBadge estado={r.estado} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-zinc-500">Fecha</dt>
                      <dd className="font-medium text-zinc-200">{formatDate(r.fecha_programada)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Km objetivo</dt>
                      <dd className="font-medium text-zinc-200">
                        {formatKilometraje(r.kilometraje_objetivo)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
