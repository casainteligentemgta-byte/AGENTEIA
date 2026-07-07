import { Badge } from "@/components/ui/badge";
import { RevisionForm } from "@/components/dashboard/revision-form";
import { getMantenimientos, getVehiculos } from "@/lib/data/dashboard";
import { getRepuestosTaller } from "@/lib/data/repuestos";
import { getMyTaller } from "@/lib/taller";
import type { TipoIndustria } from "@/lib/platform/types";
import { formatCurrency, formatDate, formatKm } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MantenimientosPage() {
  const [mantenimientos, vehiculos, taller, catalogoRepuestos] = await Promise.all([
    getMantenimientos(50),
    getVehiculos(),
    getMyTaller(),
    getRepuestosTaller(),
  ]);

  const tipoIndustria: TipoIndustria = taller?.tipo_industria ?? "concesionario";

  const vehiculoOptions = vehiculos.map((v) => ({
    id: v.id,
    placa: v.placa,
    nombre_cliente: v.nombre_cliente,
  }));

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mantenimientos</h1>
        <p className="mt-1 text-zinc-500">
          Revisiones manuales y historial vía Telegram
        </p>
      </div>

      <div className="mb-8">
        <RevisionForm
          tipoIndustria={tipoIndustria}
          vehiculos={vehiculoOptions}
          catalogoRepuestos={catalogoRepuestos}
        />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        {mantenimientos.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-zinc-400">No hay mantenimientos registrados</p>
            <p className="mt-1 text-sm text-zinc-600">
              Usa el formulario de arriba o envía una factura al bot de Telegram
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
                  <th className="px-5 py-3 font-medium">Placa</th>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Servicio</th>
                  <th className="px-5 py-3 font-medium">Km</th>
                  <th className="px-5 py-3 font-medium">Costo</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {mantenimientos.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                    <td className="px-5 py-4">
                      <Badge variant="default">{m.placa ?? "N/A"}</Badge>
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{m.nombre_cliente ?? "—"}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-zinc-300">
                      {m.descripcion ?? m.descripcion_servicio ?? "—"}
                    </td>
                    <td className="px-5 py-4 text-zinc-400">{formatKm(m.kilometraje)}</td>
                    <td className="px-5 py-4 font-medium text-zinc-200">
                      {m.costo != null ? formatCurrency(Number(m.costo)) : "—"}
                    </td>
                    <td className="px-5 py-4 text-zinc-500">{formatDate(m.created_at)}</td>
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
