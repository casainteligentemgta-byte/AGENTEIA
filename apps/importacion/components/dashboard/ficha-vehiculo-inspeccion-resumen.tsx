import type { FichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";
import { etiquetaModeloVehiculo } from "@/lib/ordenes-recepcion/ficha-vehiculo";

type Props = {
  ficha: FichaVehiculoInspeccion;
};

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-100">{value}</dd>
    </div>
  );
}

export function FichaVehiculoInspeccionResumen({ ficha }: Props) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">
        1. Información del propietario y vehículo
      </h3>
      <p className="mb-3 text-xs text-zinc-500">
        Datos tomados de la ficha al registrar el vehículo
      </p>
      <dl className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Cliente" value={ficha.clienteNombre} />
        <Campo label="Teléfono" value={ficha.clienteTelefono} />
        <Campo label="Placa" value={ficha.placa} />
        <Campo label="Modelo" value={etiquetaModeloVehiculo(ficha)} />
        <Campo label="Color" value={ficha.color ?? "—"} />
        <Campo label="Chasis" value={ficha.chasis ?? "—"} />
      </dl>
    </div>
  );
}
