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

  return (
    <div className="overflow-hidden rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
      <div className="flex items-center gap-4 p-5">
        <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl border border-white/20 bg-white/10">
          <Gauge className="h-7 w-7" strokeWidth={1.5} />
          <span className="mt-0.5 text-[9px] font-bold tracking-widest text-white/80">ODO</span>
        </div>
        <div>
          <p className="text-4xl font-bold leading-none tracking-tight">{lectura}</p>
          {ultimaVisita && (
            <p className="mt-2 text-[11px] font-medium tracking-wide text-blue-100">
              ÚLTIMA VISITA: {ultimaVisita}
            </p>
          )}
        </div>
      </div>
      {ultimoCentro && (
        <div className="flex items-start gap-2 border-t border-white/25 bg-blue-700/40 px-5 py-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/90" />
          <p className="text-[11px] font-medium leading-snug tracking-wide text-blue-50">
            ÚLTIMO CENTRO VISITADO: {ultimoCentro}
          </p>
        </div>
      )}
    </div>
  );
}
