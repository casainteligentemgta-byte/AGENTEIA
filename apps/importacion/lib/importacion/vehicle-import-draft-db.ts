import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { emptyCargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { vehicleImportEstado } from "@/lib/importacion/vehicle-import-summary";
import type { VehicleImportDraft } from "@/lib/importacion/vehicle-import-draft";
import { parseVinSources } from "@/lib/importacion/vehicle-import-vin";

export type VehicleImportDraftDocuments = {
  factura_url: string | null;
  certificates_urls: string[];
  facturaName: string | null;
  certificadoNames: string[];
  importadorId: string;
  currentVehicleIndex: number;
  extractedFieldKeys: Record<string, string[]>;
  vinSources: ReturnType<typeof parseVinSources>;
};

export type VehicleImportDraftDbRow = {
  step: number;
  vehicles: unknown;
  documents: unknown;
  updated_at?: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function vehicleStatus(row: CargaMasivaRow, draft: VehicleImportDraft): "draft" | "complete" {
  return vehicleImportEstado(row, draft.vinSources[row.id]).icon === "ok"
    ? "complete"
    : "draft";
}

export function draftToDbColumns(draft: VehicleImportDraft): {
  step: 1 | 2 | 3;
  vehicles: unknown[];
  documents: VehicleImportDraftDocuments;
} {
  return {
    step: draft.step,
    vehicles: draft.rows.map((row) => ({
      ...row,
      mark: row.marca,
      model: row.modelo,
      status: vehicleStatus(row, draft),
    })),
    documents: {
      factura_url: null,
      certificates_urls: [],
      facturaName: draft.facturaName,
      certificadoNames: draft.certificadoNames,
      importadorId: draft.importadorId,
      currentVehicleIndex: draft.currentVehicleIndex,
      extractedFieldKeys: draft.extractedFieldKeys,
      vinSources: draft.vinSources,
    },
  };
}

function parseRow(raw: unknown): CargaMasivaRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = { ...(raw as Record<string, unknown>) };
  const marca = asString(o.marca ?? o.mark);
  const modelo = asString(o.modelo ?? o.model);
  delete o.mark;
  delete o.model;
  delete o.status;
  return emptyCargaMasivaRow({
    ...(o as Partial<CargaMasivaRow>),
    marca: marca || asString(o.marca),
    modelo: modelo || asString(o.modelo),
    vin: asString(o.vin),
    serialCarroceria: asString(o.serialCarroceria),
    id: asString(o.id) || undefined,
  });
}

export function dbRowToDraft(row: VehicleImportDraftDbRow): VehicleImportDraft | null {
  if (!Array.isArray(row.vehicles) || row.vehicles.length === 0) return null;
  const docs =
    row.documents && typeof row.documents === "object"
      ? (row.documents as Record<string, unknown>)
      : {};
  const importadorId = asString(docs.importadorId);
  if (!importadorId) return null;
  const stepRaw = Number(row.step);
  const step: 1 | 2 | 3 = stepRaw === 3 ? 3 : stepRaw === 2 ? 2 : 1;
  const rows = row.vehicles
    .map(parseRow)
    .filter((item): item is CargaMasivaRow => item !== null);
  if (rows.length === 0) return null;
  const extractedFieldKeys =
    docs.extractedFieldKeys && typeof docs.extractedFieldKeys === "object"
      ? (docs.extractedFieldKeys as Record<string, string[]>)
      : {};
  return {
    importadorId,
    step,
    currentVehicleIndex: Math.max(0, Number(docs.currentVehicleIndex) || 0),
    facturaName: typeof docs.facturaName === "string" ? docs.facturaName : null,
    certificadoNames: Array.isArray(docs.certificadoNames)
      ? docs.certificadoNames.filter((name): name is string => typeof name === "string")
      : [],
    rows,
    extractedFieldKeys,
    vinSources: parseVinSources(docs.vinSources),
    updatedAt: asString(row.updated_at) || new Date().toISOString(),
  };
}

export function isMissingDraftTableError(message: string): boolean {
  return /vehicle_import_drafts|schema cache|does not exist|n[oó] existe/i.test(
    message
  );
}
