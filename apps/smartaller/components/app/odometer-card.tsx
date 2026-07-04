import { Gauge, MapPin } from "lucide-react";
import type { VehiculoUsuario } from "@/lib/vehicles/types";
import { formatOdometro, getValorOdometro } from "@/lib/vehicles/format";

type OdometerCardProps = {
  vehiculo: VehiculoUsuario;
  ultimaVisita?: string | null;
  ultimoCentro?: string | null;
};

export function OdometerCard({ vehiculo, ultimaVisita, ultimoCentro }: OdometerCardProps) {
  const valor = getValorOdometro(vehiculo);
  const lectura = formatOdometro(valor, vehiculo.unidad_odometro);
  const etiquetaUnidad = vehiculo.unidad_odometro === "horas" ? "HORAS MOTOR" : "KILOMETRAJE";

  return (
    <div className="overflow-hidden rounded-2xl bg-blue-600 text-white shadow-lg">
      <div className="flex items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15">
          <Gauge className="h-8 w-8" />
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-blue-100">{etiquetaUnidad}</p>
          <p className="text-3xl font-bold tracking-tight">{lectura}</p>
          {ultimaVisita && (
            <p className="mt-1 text-xs text-blue-100">ÚLTIMA VISITA: {ultimaVisita}</p>
          )}
        </div>
      </div>
      {ultimoCentro && (
        <div className="flex items-start gap-2 border-t border-white/20 px-5 py-3 text-xs text-blue-50">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <p>ÚLTIMO CENTRO VISITADO: {ultimoCentro}</p>
        </div>
      )}
    </div>
  );
}
