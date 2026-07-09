import {
  RECEPCION_SECCION_LABELS,
  RECEPCION_TIPO_DANO_SIMBOLO,
  CHECKLIST_MARCA_SIMBOLO,
  NIVEL_COMBUSTIBLE_LABELS,
  NOTA_AUTORIZACION_PROPIETARIO,
  checklistToMarcaRecord,
  type NivelCombustible,
} from "@/lib/schemas/orden-recepcion";
import { RECEPCION_CHECKLIST_CATALOG } from "@/lib/recepcion/catalog";
import type { OrdenRecepcionDetalle } from "@/lib/data/ordenes-recepcion";
import { ClipboardCheck } from "lucide-react";
import { formatKilometraje } from "@/lib/format";

type Props = {
  orden: OrdenRecepcionDetalle;
  odometroLabel?: string;
};

export function OrdenRecepcionDisplay({ orden, odometroLabel = "Kilometraje" }: Props) {
  const checklistMap = checklistToMarcaRecord(orden.checklist);
  const itemsMarcados = RECEPCION_CHECKLIST_CATALOG.filter((i) => checklistMap[i.id]);

  const porSeccion = itemsMarcados.reduce<Record<string, typeof itemsMarcados>>((acc, item) => {
    const key = item.seccion;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const nivelLabel =
    orden.nivel_combustible &&
    NIVEL_COMBUSTIBLE_LABELS[orden.nivel_combustible as NivelCombustible];

  return (
    <section className="glass rounded-2xl border border-blue-500/20 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Orden de recepción</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {orden.fecha_ingreso}
            {orden.hora_ingreso ? ` · ${orden.hora_ingreso.slice(0, 5)}` : ""}
          </p>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Cliente</dt>
          <dd className="text-zinc-200">{orden.cliente_nombre}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Teléfono</dt>
          <dd className="text-zinc-200">{orden.cliente_telefono}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Placa</dt>
          <dd className="font-mono text-blue-300">{orden.placa}</dd>
        </div>
        {orden.modelo && (
          <div>
            <dt className="text-zinc-500">Modelo</dt>
            <dd className="text-zinc-200">{orden.modelo}</dd>
          </div>
        )}
        {orden.color && (
          <div>
            <dt className="text-zinc-500">Color</dt>
            <dd className="text-zinc-200">{orden.color}</dd>
          </div>
        )}
        {orden.chasis && (
          <div>
            <dt className="text-zinc-500">Chasis</dt>
            <dd className="font-mono text-zinc-200">{orden.chasis}</dd>
          </div>
        )}
        {orden.kilometraje != null && (
          <div>
            <dt className="text-zinc-500">{odometroLabel}</dt>
            <dd className="text-zinc-200">{formatKilometraje(orden.kilometraje)}</dd>
          </div>
        )}
        {nivelLabel && (
          <div>
            <dt className="text-zinc-500">Combustible</dt>
            <dd className="text-zinc-200">{nivelLabel}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {orden.llego_grua && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">
            Llegó en grúa
          </span>
        )}
        {orden.vehiculo_sucio && (
          <span className="rounded-md border border-zinc-600 bg-zinc-800/50 px-2 py-1 text-zinc-400">
            Vehículo sucio
          </span>
        )}
      </div>

      {orden.motivo_visita && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500">Motivo de la visita</p>
          <p className="mt-1 text-sm text-zinc-200">{orden.motivo_visita}</p>
        </div>
      )}

      {orden.estado_ingreso_notas && (
        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-500">Estado de ingreso</p>
          <p className="mt-1 text-sm text-zinc-300">{orden.estado_ingreso_notas}</p>
        </div>
      )}

      {Object.entries(porSeccion).map(([seccion, items]) => (
        <div key={seccion} className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">
            {RECEPCION_SECCION_LABELS[seccion as keyof typeof RECEPCION_SECCION_LABELS]}
          </p>
          <ul className="space-y-1">
            {items.map((item) => {
              const marca = checklistMap[item.id]!;
              return (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-zinc-300">{item.etiqueta}</span>
                  <span
                    className={
                      marca === "check" ? "font-bold text-emerald-400" : "font-bold text-red-400"
                    }
                  >
                    {CHECKLIST_MARCA_SIMBOLO[marca]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {orden.danos.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">Daños marcados en esquema</p>
          <ul className="flex flex-wrap gap-2">
            {orden.danos.map((d, i) => (
              <li
                key={`${d.posicionX}-${i}`}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-200"
              >
                {RECEPCION_TIPO_DANO_SIMBOLO[d.tipo]} ({d.posicionX.toFixed(0)}%,{" "}
                {d.posicionY.toFixed(0)}%)
              </li>
            ))}
          </ul>
        </div>
      )}

      {orden.autorizacion_propietario && (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
          <p className="font-medium text-emerald-400">✓ Autorización del propietario</p>
          <p className="mt-1">{NOTA_AUTORIZACION_PROPIETARIO}</p>
        </div>
      )}

      {(orden.firma_cliente || orden.firma_asesor) && (
        <div className="mt-5 border-t border-zinc-800 pt-4 text-sm">
          {orden.firma_cliente && (
            <p className="text-zinc-300">
              Cliente: <span className="font-medium">{orden.firma_cliente}</span>
            </p>
          )}
          {orden.firma_asesor && (
            <p className="mt-1 text-zinc-300">
              Asesor: <span className="font-medium">{orden.firma_asesor}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
