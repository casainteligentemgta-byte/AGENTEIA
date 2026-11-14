"use client";

import type { TipoVehiculo } from "@/lib/vehicles/types";
import { listarTiposVehiculo } from "@/lib/vehicles/templates";
import { CategoriaTile, getCategoriaVisual } from "@/components/icons/categorias";
import { cn } from "@/lib/utils";

type VehicleTypePickerProps = {
  value: TipoVehiculo;
  onChange: (tipo: TipoVehiculo) => void;
};

export function VehicleTypePicker({ value, onChange }: VehicleTypePickerProps) {
  const tipos = listarTiposVehiculo();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {tipos.map((config) => {
        const selected = value === config.tipo;
        return (
          <button
            key={config.tipo}
            type="button"
            onClick={() => onChange(config.tipo)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition",
              selected
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600"
            )}
          >
            <CategoriaTile id={config.tipo} className="h-12 w-12" iconClassName="h-6 w-6" />
            <span className="text-xs font-medium leading-tight">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function VehicleTypeIcon({ tipo, className }: { tipo: TipoVehiculo; className?: string }) {
  const { Icon } = getCategoriaVisual(tipo);
  return <Icon className={className} />;
}
