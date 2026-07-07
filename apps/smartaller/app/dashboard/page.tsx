import Link from "next/link";
import { Car, ClipboardList, Bell, DollarSign, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { IngresosChart } from "@/components/dashboard/ingresos-chart";
import { TopRanking } from "@/components/dashboard/top-ranking";
import {
  getDashboardStats,
  getIngresosPorMes,
  getMantenimientos,
  getRecordatorios,
  getTopClientes,
  getTopVehiculos,
} from "@/lib/data/dashboard";
import { formatCurrency, formatDate, formatKm } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [statsResult, ingresosPorMes, topClientes, topVehiculos, mantenimientos, recordatorios] =
    await Promise.all([
      getDashboardStats(),
      getIngresosPorMes(6),
      getTopClientes(5),
      getTopVehiculos(5),
      getMantenimientos(8),
      getRecordatorios(),
    ]);

  const { stats, error: statsError } = statsResult;
  const proximosRecordatorios = recordatorios.filter((r) => r.estado === "pendiente").slice(0, 5);

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-zinc-500">Resumen de tu taller en tiempo real</p>
      </div>

      {statsError && (
        <div className="mb-6 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          No se pudieron cargar todas las estadísticas: {statsError}. Revisa la conexión con Supabase
          o las políticas RLS del taller.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vehículos" value={String(stats.totalVehiculos)} icon={Car} />
        <StatCard label="Mantenimientos" value={String(stats.totalMantenimientos)} icon={ClipboardList} />
        <StatCard
          label="Recordatorios pendientes"
          value={String(stats.recordatoriosPendientes)}
          icon={Bell}
        />
        <StatCard
          label="Ingresos del mes"
          value={formatCurrency(stats.ingresosMes)}
          icon={DollarSign}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="glass rounded-2xl p-5 lg:col-span-3">
          <div className="mb-4">
            <h2 className="font-semibold text-zinc-100">Ingresos por mes</h2>
            <p className="mt-1 text-sm text-zinc-500">Últimos 6 meses</p>
          </div>
          <IngresosChart data={ingresosPorMes} />
        </section>

        <div className="grid gap-6 lg:col-span-2">
          <TopRanking
            title="Top clientes"
            items={topClientes}
            emptyMessage="Aún no hay clientes con servicios registrados."
          />
          <TopRanking
            title="Top vehículos"
            items={topVehiculos}
            emptyMessage="Aún no hay vehículos con servicios registrados."
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <section className="glass rounded-2xl lg:col-span-3">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="font-semibold">Últimos mantenimientos</h2>
            <Link
              href="/dashboard/mantenimientos"
              className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {mantenimientos.length === 0 ? (
            <EmptyState
              title="Sin mantenimientos aún"
              desc="Envía una foto de factura al bot de Telegram para registrar el primero."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-500">
                    <th className="px-5 py-3 font-medium">Placa</th>
                    <th className="px-5 py-3 font-medium">Servicio</th>
                    <th className="px-5 py-3 font-medium">Costo</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {mantenimientos.map((m) => (
                    <tr key={m.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                      <td className="px-5 py-3 font-medium text-zinc-200">{m.placa ?? "—"}</td>
                      <td className="max-w-[200px] truncate px-5 py-3 text-zinc-400">
                        {m.descripcion ?? m.descripcion_servicio ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-300">
                        {m.costo != null ? formatCurrency(Number(m.costo)) : "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-500">{formatDate(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
            <h2 className="font-semibold">Próximos servicios</h2>
            <Link
              href="/dashboard/recordatorios"
              className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {proximosRecordatorios.length === 0 ? (
            <EmptyState title="Sin recordatorios" desc="Se crean automáticamente al registrar un mantenimiento." />
          ) : (
            <ul className="divide-y divide-zinc-800/50">
              {proximosRecordatorios.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-medium text-zinc-200">
                      {r.vehiculos?.placa ?? "Sin placa"}
                    </p>
                    <p className="text-sm text-zinc-500">
                      {r.vehiculos?.nombre_cliente ?? "Cliente sin nombre"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-300">{formatDate(r.fecha_programada)}</p>
                    <p className="text-xs text-zinc-500">{formatKm(r.kilometraje_objetivo)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-medium text-zinc-400">{title}</p>
      <p className="mt-1 text-sm text-zinc-600">{desc}</p>
    </div>
  );
}
