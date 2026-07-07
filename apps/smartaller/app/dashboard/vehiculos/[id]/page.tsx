import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DiagnosticoGaleria } from "@/components/app/diagnostico-galeria";
import { RepuestosLista } from "@/components/app/repuestos-lista";
import { DiagnosticoMediaUpload } from "@/components/dashboard/diagnostico-media-upload";
import { MantenimientoRepuestosEditor } from "@/components/dashboard/mantenimiento-repuestos-editor";
import { VehiculoEditForm } from "@/components/dashboard/vehiculo-edit-form";
import { getRepuestosPorMantenimientoIds, getRepuestosTaller } from "@/lib/data/repuestos";
import { parseMediaFromDetalle } from "@/lib/schemas/diagnostico-media";
import { getVehiculoDetalle } from "@/lib/data/vehiculos";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatKilometraje,
  getDescripcion,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = {
  params: { id: string };
};

function estadoVariant(estado: string): "default" | "success" | "warning" | "danger" {
  if (estado === "enviado") return "success";
  if (estado === "pendiente") return "warning";
  if (estado === "cancelado") return "danger";
  return "default";
}

export default async function VehiculoDetallePage({ params }: Props) {
  const vehiculo = await getVehiculoDetalle(params.id);
  if (!vehiculo) notFound();

  const [catalogoRepuestos, repuestosMap] = await Promise.all([
    getRepuestosTaller(),
    getRepuestosPorMantenimientoIds(vehiculo.mantenimientos.map((m) => m.id)),
  ]);

  const proximoRecordatorio = vehiculo.recordatorios.find(
    (r) => r.estado === "pendiente" || r.estado === "enviado"
  );

  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/dashboard/vehiculos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a vehículos
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-3xl font-bold tracking-wide text-blue-400">{vehiculo.placa}</p>
          <p className="mt-1 text-zinc-500">
            Kilometraje: {formatKilometraje(vehiculo.kilometraje_ultimo)} · Registrado{" "}
            {formatDate(vehiculo.created_at)}
          </p>
        </div>
        {proximoRecordatorio && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-xs font-medium text-amber-300">Próximo servicio</p>
            <p className="text-sm font-semibold text-amber-100">
              {formatDate(proximoRecordatorio.fecha_programada)}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-8">
        <VehiculoEditForm
          vehiculoId={vehiculo.id}
          nombreCliente={vehiculo.nombre_cliente}
          telefonoCliente={vehiculo.telefono_cliente}
        />

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Historial de servicios</h2>
          {vehiculo.mantenimientos.length === 0 ? (
            <p className="glass rounded-2xl p-6 text-sm text-zinc-500">
              Sin mantenimientos registrados aún.
            </p>
          ) : (
            <ul className="space-y-3">
              {vehiculo.mantenimientos.map((m) => {
                const media = parseMediaFromDetalle(m.detalle_revision);
                const repuestos = repuestosMap.get(m.id) ?? [];

                return (
                <li key={m.id} className="glass rounded-2xl p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-100">{getDescripcion(m)}</p>
                      <p className="mt-1 text-sm text-zinc-500">{formatDateTime(m.created_at)}</p>
                    </div>
                    <p className="text-lg font-semibold text-zinc-100">{formatCurrency(m.costo)}</p>
                  </div>
                  {m.kilometraje != null && (
                    <p className="mt-2 text-sm text-zinc-400">
                      Kilometraje: {formatKilometraje(m.kilometraje)}
                    </p>
                  )}

                  {media.length > 0 && (
                    <div className="mt-4">
                      <DiagnosticoGaleria
                        media={media}
                        variant="dark"
                        compact
                        titulo="Evidencia visual"
                      />
                    </div>
                  )}

                  {repuestos.length > 0 && (
                    <div className="mt-4">
                      <RepuestosLista lineas={repuestos} variant="dark" />
                    </div>
                  )}

                  <MantenimientoRepuestosEditor
                    mantenimientoId={m.id}
                    catalogo={catalogoRepuestos}
                  />

                  <DiagnosticoMediaUpload mantenimientoId={m.id} compact />
                </li>
              );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Recordatorios</h2>
          {vehiculo.recordatorios.length === 0 ? (
            <p className="glass rounded-2xl p-6 text-sm text-zinc-500">Sin recordatorios.</p>
          ) : (
            <ul className="space-y-2">
              {vehiculo.recordatorios.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-zinc-200">{formatDate(r.fecha_programada)}</p>
                    {r.kilometraje_objetivo != null && (
                      <p className="text-xs text-zinc-500">
                        Km objetivo: {formatKilometraje(r.kilometraje_objetivo)}
                      </p>
                    )}
                  </div>
                  <Badge variant={estadoVariant(r.estado)}>{r.estado}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
