import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DiagnosticoGaleria } from "@/components/app/diagnostico-galeria";
import { RepuestosLista } from "@/components/app/repuestos-lista";
import { DiagnosticoMediaUpload } from "@/components/dashboard/diagnostico-media-upload";
import { MantenimientoRepuestosEditor } from "@/components/dashboard/mantenimiento-repuestos-editor";
import { VehiculoEditForm } from "@/components/dashboard/vehiculo-edit-form";
import { getRepuestosPorMantenimientoIds, getRepuestosTaller } from "@/lib/data/repuestos";
import { parseMediaFromDetalle } from "@/lib/schemas/diagnostico-media";
import { getVehiculoDetalle } from "@/lib/data/vehiculos";
import { parseVehiculosDocumentos } from "@/lib/schemas/vehiculo-documentos";
import { parseRecepcionVehiculo, tieneDatosRecepcion } from "@/lib/schemas/recepcion-vehiculo";
import { RecepcionVehiculoDisplay } from "@/components/dashboard/recepcion-vehiculo-display";
import { OrdenRecepcionDisplay } from "@/components/dashboard/orden-recepcion-display";
import { getUltimaOrdenRecepcionVehiculo } from "@/lib/data/ordenes-recepcion";
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
  searchParams: { registrado?: string };
};

function estadoVariant(estado: string): "default" | "success" | "warning" | "danger" {
  if (estado === "enviado") return "success";
  if (estado === "pendiente") return "warning";
  if (estado === "cancelado") return "danger";
  return "default";
}

export default async function VehiculoDetallePage({ params, searchParams }: Props) {
  const vehiculo = await getVehiculoDetalle(params.id);
  if (!vehiculo) notFound();

  const [catalogoRepuestos, repuestosMap, ordenRecepcion] = await Promise.all([
    getRepuestosTaller(),
    getRepuestosPorMantenimientoIds(vehiculo.mantenimientos.map((m) => m.id)),
    getUltimaOrdenRecepcionVehiculo(vehiculo.id, vehiculo.ultima_orden_recepcion_id),
  ]);

  const proximoRecordatorio = vehiculo.recordatorios.find(
    (r) => r.estado === "pendiente" || r.estado === "enviado"
  );
  const documentos = parseVehiculosDocumentos(vehiculo.documentos);
  const recepcionInicial = parseRecepcionVehiculo(vehiculo.recepcion_inicial);
  const tieneFichaTecnica =
    vehiculo.marca ||
    vehiculo.modelo ||
    vehiculo.color ||
    vehiculo.serial_motor ||
    vehiculo.serial_carroceria ||
    vehiculo.cedula_propietario ||
    vehiculo.email_propietario ||
    vehiculo.fecha_nacimiento_propietario;

  return (
    <div className="p-4 sm:p-8">
      <Link
        href="/dashboard/vehiculos"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a vehículos
      </Link>

      {searchParams.registrado === "1" && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Vehículo registrado correctamente. Cuando llegue al taller, inicia la{" "}
          <strong className="text-emerald-100">inspección de ingreso</strong> con el botón de abajo
          o envía una foto de la placa por Telegram (pie de foto: <em>inspeccion</em>).
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-3xl font-bold tracking-wide text-blue-400">{vehiculo.placa}</p>
          <p className="mt-1 text-zinc-500">
            Kilometraje: {formatKilometraje(vehiculo.kilometraje_ultimo)} · Registrado{" "}
            {formatDate(vehiculo.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Link
            href={`/dashboard/vehiculos/${vehiculo.id}/inspeccion`}
            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
          >
            <ClipboardCheck className="h-4 w-4" />
            {ordenRecepcion ? "Nueva inspección" : "Inspección de ingreso"}
          </Link>
          {proximoRecordatorio && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-xs font-medium text-amber-300">Próximo servicio</p>
              <p className="text-sm font-semibold text-amber-100">
                {formatDate(proximoRecordatorio.fecha_programada)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {(tieneFichaTecnica || documentos.cedula || documentos.titulo) && (
          <section className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-zinc-100">Ficha del vehículo</h2>
            {tieneFichaTecnica && (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {vehiculo.marca && (
                  <>
                    <dt className="text-zinc-500">Marca</dt>
                    <dd className="text-zinc-200">{vehiculo.marca}</dd>
                  </>
                )}
                {vehiculo.modelo && (
                  <>
                    <dt className="text-zinc-500">Modelo</dt>
                    <dd className="text-zinc-200">{vehiculo.modelo}</dd>
                  </>
                )}
                {vehiculo.color && (
                  <>
                    <dt className="text-zinc-500">Color</dt>
                    <dd className="text-zinc-200">{vehiculo.color}</dd>
                  </>
                )}
                {vehiculo.serial_motor && (
                  <>
                    <dt className="text-zinc-500">Serial motor</dt>
                    <dd className="font-mono text-zinc-200">{vehiculo.serial_motor}</dd>
                  </>
                )}
                {vehiculo.serial_carroceria && (
                  <>
                    <dt className="text-zinc-500">Serial carrocería</dt>
                    <dd className="font-mono text-zinc-200">{vehiculo.serial_carroceria}</dd>
                  </>
                )}
                {vehiculo.cedula_propietario && (
                  <>
                    <dt className="text-zinc-500">Cédula propietario</dt>
                    <dd className="font-mono text-zinc-200">{vehiculo.cedula_propietario}</dd>
                  </>
                )}
                {vehiculo.email_propietario && (
                  <>
                    <dt className="text-zinc-500">Email propietario</dt>
                    <dd className="text-zinc-200">{vehiculo.email_propietario}</dd>
                  </>
                )}
                {vehiculo.fecha_nacimiento_propietario && (
                  <>
                    <dt className="text-zinc-500">Fecha de nacimiento</dt>
                    <dd className="text-zinc-200">
                      {formatDate(vehiculo.fecha_nacimiento_propietario)}
                    </dd>
                  </>
                )}
              </dl>
            )}
            {(documentos.cedula || documentos.titulo) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {documentos.cedula && (
                  <a
                    href={documentos.cedula.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-blue-300 hover:border-blue-500"
                  >
                    Ver cédula escaneada
                  </a>
                )}
                {documentos.titulo && (
                  <a
                    href={documentos.titulo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-blue-300 hover:border-blue-500"
                  >
                    Ver título de propiedad
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        {ordenRecepcion ? (
          <OrdenRecepcionDisplay orden={ordenRecepcion} />
        ) : (
          <>
            <section className="glass rounded-2xl border border-dashed border-blue-500/30 p-6 text-center">
              <p className="text-sm text-zinc-400">Este vehículo aún no tiene inspección de ingreso.</p>
              <Link
                href={`/dashboard/vehiculos/${vehiculo.id}/inspeccion`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                <ClipboardCheck className="h-4 w-4" />
                Completar inspección
              </Link>
            </section>
            {recepcionInicial && tieneDatosRecepcion(recepcionInicial) && (
              <RecepcionVehiculoDisplay recepcion={recepcionInicial} />
            )}
          </>
        )}

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
