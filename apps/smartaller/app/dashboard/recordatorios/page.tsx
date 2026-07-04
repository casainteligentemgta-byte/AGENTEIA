import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { RecordatorioActions } from "@/components/dashboard/recordatorio-actions";
import { getRecordatorios } from "@/lib/data/dashboard";
import { formatDate, formatKm } from "@/lib/utils";

export const dynamic = "force-dynamic";

function estadoVariant(estado: string): "default" | "success" | "warning" | "danger" {
  if (estado === "enviado") return "success";
  if (estado === "pendiente") return "warning";
  if (estado === "cancelado") return "danger";
  return "default";
}

export default async function RecordatoriosPage() {
  const recordatorios = await getRecordatorios();

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recordatorios</h1>
        <p className="mt-1 text-zinc-500">Próximos servicios programados (+6 meses / +5000 km)</p>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {recordatorios.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-zinc-400">No hay recordatorios</p>
            <p className="mt-1 text-sm text-zinc-600">
              Se generan al registrar cada mantenimiento
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
                  <th className="px-5 py-3 font-medium">Placa</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Fecha programada</th>
                  <th className="px-5 py-3 font-medium">Km objetivo</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recordatorios.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                    <td className="px-5 py-4 font-medium text-zinc-200">
                      <Link
                        href={`/dashboard/vehiculos/${r.vehiculo_id}`}
                        className="hover:text-blue-400"
                      >
                        {r.vehiculos?.placa ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">
                      {r.vehiculos?.nombre_cliente ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-zinc-300">{formatDate(r.fecha_programada)}</td>
                    <td className="px-5 py-4 text-zinc-400">{formatKm(r.kilometraje_objetivo)}</td>
                    <td className="px-5 py-4">
                      <Badge variant={estadoVariant(r.estado)}>{r.estado}</Badge>
                    </td>
                    <td className="px-5 py-4">
                      <RecordatorioActions recordatorioId={r.id} estado={r.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
