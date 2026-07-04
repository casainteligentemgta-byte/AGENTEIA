import { CircleDot } from "lucide-react";
import type { ConfigTipoVehiculo } from "@/lib/vehicles/types";

type WheelsGridProps = {
  config: ConfigTipoVehiculo;
};

export function WheelsGrid({ config }: WheelsGridProps) {
  const total = config.ruedas;
  const slots = Array.from({ length: total }, (_, i) => i);
  const gridClass = total <= 2 ? "grid-cols-2" : total <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="app-card-white p-4">
      <p className="mb-3 text-sm font-bold text-zinc-800">
        {config.incluyeRepuesto ? "Neumáticos y repuesto" : "Neumáticos"}
      </p>
      <div className={`grid gap-3 ${gridClass}`}>
        {slots.map((i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center rounded-xl border border-zinc-100 bg-zinc-50 py-5"
          >
            <CircleDot className="h-9 w-9 text-zinc-300" strokeWidth={1.25} />
            <p className="mt-2 text-[11px] font-medium text-zinc-400">
              {total === 2 ? (i === 0 ? "Delantera" : "Trasera") : `Rueda ${i + 1}`}
            </p>
          </div>
        ))}
        {config.incluyeRepuesto && (
          <div className="col-span-full flex items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3">
            <CircleDot className="h-5 w-5 text-zinc-300" />
            <p className="text-sm text-zinc-500">Repuesto — datos tras 1ª visita</p>
          </div>
        )}
      </div>
    </div>
  );
}
