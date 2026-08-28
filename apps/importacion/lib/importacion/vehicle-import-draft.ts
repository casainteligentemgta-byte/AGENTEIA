import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import type { VinDocSources } from "@/lib/importacion/vehicle-import-vin";

export const VEHICLE_IMPORT_DRAFT_KEY = "pl-vehicle-import-draft-v1";

export type VehicleImportDraft = {
  importadorId: string;
  step: 1 | 2 | 3;
  currentVehicleIndex: number;
  facturaName: string | null;
  certificadoNames: string[];
  rows: CargaMasivaRow[];
  extractedFieldKeys: Record<string, string[]>;
  vinSources: Record<string, VinDocSources>;
  updatedAt: string;
};

export function draftStorageKey(tallerId: string, importadorId: string): string {
  return `${VEHICLE_IMPORT_DRAFT_KEY}:${tallerId}:${importadorId}`;
}

export function readVehicleImportDraft(
  tallerId: string,
  importadorId: string
): VehicleImportDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(tallerId, importadorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VehicleImportDraft;
    if (!parsed?.rows || !Array.isArray(parsed.rows)) return null;
    if (parsed.importadorId !== importadorId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVehicleImportDraft(
  tallerId: string,
  draft: VehicleImportDraft
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      draftStorageKey(tallerId, draft.importadorId),
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Quota / modo privado: no bloquear el flujo.
  }
}

export function clearVehicleImportDraft(
  tallerId: string,
  importadorId: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftStorageKey(tallerId, importadorId));
  } catch {
    // ignore
  }
}

export function pickNewerDraft(
  a: VehicleImportDraft | null,
  b: VehicleImportDraft | null
): VehicleImportDraft | null {
  if (!a) return b;
  if (!b) return a;
  const aTime = Date.parse(a.updatedAt) || 0;
  const bTime = Date.parse(b.updatedAt) || 0;
  return aTime >= bTime ? a : b;
}

export function extractedKeysFromRow(row: CargaMasivaRow): string[] {
  const skip = new Set(["id", "fuente", "error", "kilometraje"]);
  const keys: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (skip.has(key)) continue;
    if (typeof value === "string" && value.trim()) keys.push(key);
  }
  return keys;
}
