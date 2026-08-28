import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { vehicleSemaforo } from "@/lib/importacion/carga-masiva-ui";
import {
  evaluateVinCrossCheck,
  type VinDocSources,
} from "@/lib/importacion/vehicle-import-vin";

export type VehicleImportEstadoIcon = "ok" | "warn" | "critical";

export type VehicleImportEstado = {
  icon: VehicleImportEstadoIcon;
  mark: string;
  label: string;
  className: string;
};

const FALTA_LABEL: Record<string, string> = {
  motor: "serial motor",
  color: "color",
  año: "año",
  marca: "marca",
  modelo: "modelo",
  VIN: "VIN",
  "VIN incompleto": "VIN",
  "error de validación": "validación",
  condición: "condición",
  subasta: "subasta",
  certificado: "certificado",
  CC: "CC",
};

function faltaLabel(keys: string[]): string | null {
  const first = keys.find(Boolean);
  if (!first) return null;
  return FALTA_LABEL[first] ?? first;
}

export function vehicleImportEstado(
  row: CargaMasivaRow,
  sources?: VinDocSources
): VehicleImportEstado {
  const sem = vehicleSemaforo(row);
  const vinCheck = evaluateVinCrossCheck(
    row.vin || row.serialCarroceria,
    sources
  );
  const vinFail = vinCheck.items.some((item) => item.status === "fail");
  const vinWarn = vinCheck.items.some((item) => item.status === "warn");
  const extras: string[] = [];
  if (!row.cilindradaCc.trim()) extras.push("CC");

  if (!sem.registrable || vinFail) {
    return {
      icon: "critical",
      mark: "○",
      label: vinFail ? "VIN inválido" : "Falta VIN",
      className: "text-red-300",
    };
  }

  if (sem.nivel === "verde" && !vinWarn && extras.length === 0) {
    return {
      icon: "ok",
      mark: "✓",
      label: "Completo",
      className: "text-emerald-300",
    };
  }

  const missing = [
    ...(vinWarn ? ["certificado"] : []),
    ...sem.criticos,
    ...sem.avisos,
    ...extras,
  ];
  const detail = faltaLabel(missing);
  return {
    icon: "warn",
    mark: "⚠️",
    label: detail ? `Falta ${detail}` : "Incompleto",
    className: "text-amber-300",
  };
}
