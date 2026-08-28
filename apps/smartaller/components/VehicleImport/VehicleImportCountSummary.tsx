"use client";

import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { summarizeVehicleImport } from "@/lib/importacion/vehicle-import-summary";
import type { VinDocSources } from "@/lib/importacion/vehicle-import-vin";

type Props = {
  rows: CargaMasivaRow[];
  vinSources: Record<string, VinDocSources>;
};

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function VehicleImportCountSummary({ rows, vinSources }: Props) {
  const summary = summarizeVehicleImport(rows, vinSources);
  const incompleteExtra = summary.incompleteReason
    ? ` (${summary.incompleteReason})`
    : "";
  const completeExtra =
    summary.complete > 0 ? " (listos para guardar)" : "";

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3 font-mono text-sm leading-relaxed"
      aria-label={`Resumen: ${summary.total} ${plural(summary.total, "vehículo", "vehículos")}`}
    >
      <p className="text-zinc-100">
        📊 Resumen: {summary.total}{" "}
        {plural(summary.total, "vehículo", "vehículos")}
      </p>
      <p className="text-emerald-300">
        ├─ ✓ {summary.complete}{" "}
        {plural(summary.complete, "completo", "completos")}
        {completeExtra}
      </p>
      <p className="text-amber-300">
        ├─ ⚠️ {summary.incomplete}{" "}
        {plural(summary.incomplete, "incompleto", "incompletos")}
        {incompleteExtra}
      </p>
      <p className="text-red-300">
        └─ ○ {summary.critical}{" "}
        {plural(summary.critical, "error crítico", "errores críticos")}
      </p>
    </div>
  );
}
