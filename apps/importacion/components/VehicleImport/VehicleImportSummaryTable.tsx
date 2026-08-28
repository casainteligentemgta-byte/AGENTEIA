"use client";

import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { vehicleImportEstado } from "@/lib/importacion/vehicle-import-summary";
import { rowVinValue, type VinDocSources } from "@/lib/importacion/vehicle-import-vin";

type Props = {
  rows: CargaMasivaRow[];
  vinSources: Record<string, VinDocSources>;
  activeIndex?: number;
  onSelect?: (index: number) => void;
};

export function VehicleImportSummaryTable({
  rows,
  vinSources,
  activeIndex,
  onSelect,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Vehículo</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Marca</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Año</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">VIN</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const estado = vehicleImportEstado(row, vinSources[row.id]);
            const active = activeIndex === index;
            return (
              <tr
                key={row.id}
                className={`border-t border-zinc-800 ${
                  active ? "bg-cyan-950/40" : "bg-zinc-950/40"
                } ${onSelect ? "cursor-pointer hover:bg-zinc-900/80" : ""}`}
                onClick={onSelect ? () => onSelect(index) : undefined}
                onKeyDown={
                  onSelect
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(index);
                        }
                      }
                    : undefined
                }
                tabIndex={onSelect ? 0 : undefined}
                role={onSelect ? "button" : undefined}
                aria-label={
                  onSelect
                    ? `Revisar vehículo ${index + 1}, ${estado.label}`
                    : undefined
                }
              >
                <td className="px-3 py-2 tabular-nums text-zinc-500">{index + 1}</td>
                <td className="max-w-[8rem] truncate px-3 py-2 font-medium text-zinc-100">
                  {row.marca.trim() || "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">{row.anio.trim() || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-300">
                  {rowVinValue(row) || "—"}
                </td>
                <td className={`whitespace-nowrap px-3 py-2 text-xs ${estado.className}`}>
                  {estado.mark} {estado.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
