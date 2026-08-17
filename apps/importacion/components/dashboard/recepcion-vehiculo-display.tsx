import {
  ESTADO_RECEPCION_LABELS,
  INVENTARIO_RECEPCION_ITEMS,
  NIVEL_COMBUSTIBLE_LABELS,
  SISTEMAS_RECEPCION,
  ZONAS_EXTERIOR,
  type EstadoRecepcion,
  type RecepcionVehiculo,
} from "@/lib/schemas/recepcion-vehiculo";
import { ClipboardCheck } from "lucide-react";

type Props = {
  recepcion: RecepcionVehiculo;
  odometroLabel?: string;
};

function EstadoBadge({ estado }: { estado: EstadoRecepcion }) {
  const tone =
    estado === "bueno"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : estado === "regular"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
        : estado === "malo"
          ? "text-red-400 bg-red-500/10 border-red-500/30"
          : "text-zinc-500 bg-zinc-800/50 border-zinc-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${tone}`}>
      {ESTADO_RECEPCION_LABELS[estado]}
    </span>
  );
}

export function RecepcionVehiculoDisplay({ recepcion, odometroLabel = "Kilometraje" }: Props) {
  const inventarioMarcado = INVENTARIO_RECEPCION_ITEMS.filter((i) => recepcion.inventario?.[i.id]);
  const exteriorConEstado = ZONAS_EXTERIOR.filter(
    (z) => recepcion.exterior?.[z.id] && recepcion.exterior[z.id] !== "na"
  );
  const sistemasConEstado = SISTEMAS_RECEPCION.filter(
    (s) => recepcion.sistemas?.[s.id] && recepcion.sistemas[s.id] !== "na"
  );

  return (
    <section className="glass rounded-2xl border border-blue-500/20 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Acta de recepción</h2>
          <p className="mt-1 text-sm text-zinc-500">Estado del vehículo al ingreso al taller</p>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {recepcion.fechaIngreso && (
          <>
            <dt className="text-zinc-500">Fecha de ingreso</dt>
            <dd className="text-zinc-200">{recepcion.fechaIngreso}</dd>
          </>
        )}
        {recepcion.horaIngreso && (
          <>
            <dt className="text-zinc-500">Hora</dt>
            <dd className="text-zinc-200">{recepcion.horaIngreso}</dd>
          </>
        )}
        {recepcion.kilometrajeIngreso != null && (
          <>
            <dt className="text-zinc-500">{odometroLabel} al ingreso</dt>
            <dd className="font-mono text-zinc-200">
              {recepcion.kilometrajeIngreso.toLocaleString("es-CO")}
            </dd>
          </>
        )}
        {recepcion.nivelCombustible && (
          <>
            <dt className="text-zinc-500">Combustible</dt>
            <dd className="text-zinc-200">
              {NIVEL_COMBUSTIBLE_LABELS[recepcion.nivelCombustible]}
            </dd>
          </>
        )}
      </dl>

      {recepcion.motivoIngreso?.trim() && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500">Motivo de ingreso</p>
          <p className="mt-1 text-sm text-zinc-200">{recepcion.motivoIngreso}</p>
        </div>
      )}

      {inventarioMarcado.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">Inventario entregado</p>
          <ul className="flex flex-wrap gap-2">
            {inventarioMarcado.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-700 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-300"
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {exteriorConEstado.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">Estado exterior</p>
          <ul className="space-y-1.5">
            {exteriorConEstado.map((z) => (
              <li key={z.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{z.label}</span>
                <EstadoBadge estado={recepcion.exterior![z.id] as EstadoRecepcion} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {sistemasConEstado.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-zinc-500">Sistemas y fluidos</p>
          <ul className="space-y-1.5">
            {sistemasConEstado.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-300">{s.label}</span>
                <EstadoBadge estado={recepcion.sistemas![s.id] as EstadoRecepcion} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {(recepcion.danosPreexistentes?.trim() || recepcion.objetosValor?.trim()) && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {recepcion.danosPreexistentes?.trim() && (
            <div>
              <p className="text-xs font-medium text-zinc-500">Daños preexistentes</p>
              <p className="mt-1 text-sm text-zinc-300">{recepcion.danosPreexistentes}</p>
            </div>
          )}
          {recepcion.objetosValor?.trim() && (
            <div>
              <p className="text-xs font-medium text-zinc-500">Objetos de valor</p>
              <p className="mt-1 text-sm text-zinc-300">{recepcion.objetosValor}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-zinc-800 pt-4 text-sm text-zinc-400">
        {recepcion.autorizaDiagnostico !== false && (
          <p>✓ Autoriza diagnóstico y pruebas necesarias</p>
        )}
        {recepcion.firmaCliente?.trim() && (
          <p className="mt-2 text-zinc-300">
            Conformidad: <span className="font-medium">{recepcion.firmaCliente}</span>
          </p>
        )}
      </div>
    </section>
  );
}
