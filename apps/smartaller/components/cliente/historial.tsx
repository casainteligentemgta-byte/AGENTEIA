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
      <section className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-6">
        <p className="text-sm font-medium text-blue-300">Tu vehículo</p>
        <h2 className="mt-1 font-mono text-3xl font-bold tracking-wide text-zinc-100">
          {vehiculo.placa}
        </h2>
        {vehiculo.nombre_cliente && (
          <p className="mt-2 text-zinc-300">{vehiculo.nombre_cliente}</p>
        )}
        <p className="mt-1 text-sm text-zinc-400">
          Kilometraje registrado: {formatKilometraje(vehiculo.kilometraje_ultimo)}
        </p>
      </section>

      {proximoRecordatorio && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <p className="text-sm font-medium text-amber-300">Próximo servicio recomendado</p>
          <p className="mt-2 text-2xl font-bold text-amber-100">
            {formatDate(proximoRecordatorio.fecha_programada)}
          </p>
          {proximoRecordatorio.kilometraje_objetivo != null && (
            <p className="mt-1 text-sm text-amber-200/80">
              o al llegar a {formatKilometraje(proximoRecordatorio.kilometraje_objetivo)}
            </p>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-4 text-lg font-semibold text-zinc-100">Historial de servicios</h3>
        {vehiculo.mantenimientos.length === 0 ? (
          <p className="glass rounded-2xl p-6 text-sm text-zinc-500">
            Aún no hay servicios registrados para este vehículo.
          </p>
        ) : (
          <ul className="space-y-3">
            {vehiculo.mantenimientos.map((m) => (
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
