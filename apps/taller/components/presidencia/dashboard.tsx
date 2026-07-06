import { formatCurrency, formatDate, formatDateTime, formatKilometraje, getDescripcion } from "@/lib/format";
import type { Mantenimiento, PresidenciaStats, RecordatorioConPlaca } from "@/lib/types";

type Props = {
  stats: PresidenciaStats;
  mantenimientos: Mantenimiento[];
  recordatorios: RecordatorioConPlaca[];
  tallerNombre: string;
};

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    pendiente: "bg-amber-100 text-amber-800",
    enviado: "bg-blue-100 text-blue-800",
    completado: "bg-emerald-100 text-emerald-800",
    cancelado: "bg-slate-100 text-slate-600",
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
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">Panel de recepción</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tallerNombre}</h1>
          <p className="text-sm text-slate-500">
            Servicios registrados vía Telegram · actualización automática cada 30 s
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {new Date().toLocaleString("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Servicios hoy" value={stats.serviciosHoy} accent="text-brand-600" />
        <StatCard label="Servicios este mes" value={stats.serviciosMes} accent="text-slate-900" />
        <StatCard label="Vehículos registrados" value={stats.vehiculosRegistrados} accent="text-slate-900" />
        <StatCard
          label="Recordatorios pendientes"
          value={stats.recordatoriosPendientes}
          accent="text-amber-600"
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Últimos servicios</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {mantenimientos.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                Aún no hay servicios. Los mecánicos pueden registrar facturas enviando fotos al bot de Telegram.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Fecha</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Placa</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Cliente</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Servicio</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mantenimientos.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDateTime(m.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900">
                          {m.placa ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{m.nombre_cliente ?? "—"}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                          {getDescripcion(m)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
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

        <section className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Próximos servicios</h2>
          <div className="space-y-3">
            {recordatorios.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
                No hay recordatorios programados.
              </div>
            ) : (
              recordatorios.map((r) => (
                <article
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-bold text-slate-900">{r.placa}</p>
                      <p className="text-sm text-slate-600">{r.nombre_cliente ?? "Cliente sin nombre"}</p>
                    </div>
                    <EstadoBadge estado={r.estado} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500">Fecha</dt>
                      <dd className="font-medium text-slate-900">{formatDate(r.fecha_programada)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Km objetivo</dt>
                      <dd className="font-medium text-slate-900">
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
