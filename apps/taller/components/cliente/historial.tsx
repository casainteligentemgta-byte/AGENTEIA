import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatKilometraje,
  getDescripcion,
} from "@/lib/format";
import type { VehiculoConHistorial } from "@/lib/types";

type Props = {
  vehiculo: VehiculoConHistorial;
};

export function HistorialVehiculo({ vehiculo }: Props) {
  const proximoRecordatorio = vehiculo.recordatorios[0];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-brand-100 bg-brand-50 p-6">
        <p className="text-sm font-medium text-brand-700">Tu vehículo</p>
        <h2 className="mt-1 font-mono text-3xl font-bold tracking-wide text-brand-900">
          {vehiculo.placa}
        </h2>
        {vehiculo.nombre_cliente && (
          <p className="mt-2 text-slate-700">{vehiculo.nombre_cliente}</p>
        )}
        <p className="mt-1 text-sm text-slate-600">
          Kilometraje registrado: {formatKilometraje(vehiculo.kilometraje_ultimo)}
        </p>
      </section>

      {proximoRecordatorio && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-medium text-amber-800">Próximo servicio recomendado</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">
            {formatDate(proximoRecordatorio.fecha_programada)}
          </p>
          {proximoRecordatorio.kilometraje_objetivo != null && (
            <p className="mt-1 text-sm text-amber-800">
              o al llegar a {formatKilometraje(proximoRecordatorio.kilometraje_objetivo)}
            </p>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Historial de servicios</h3>
        {vehiculo.mantenimientos.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Aún no hay servicios registrados para este vehículo.
          </p>
        ) : (
          <ul className="space-y-3">
            {vehiculo.mantenimientos.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{getDescripcion(m)}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(m.created_at)}</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{formatCurrency(m.costo)}</p>
                </div>
                {m.kilometraje != null && (
                  <p className="mt-2 text-sm text-slate-600">
                    Kilometraje: {formatKilometraje(m.kilometraje)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
