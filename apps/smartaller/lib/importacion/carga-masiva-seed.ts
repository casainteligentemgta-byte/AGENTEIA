import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";

/** sessionStorage: filas pre-cargadas tras OCR de hoja anexa multi-vehículo. */
export const PL_CARGA_MASIVA_SEED_KEY = "pl-carga-masiva-seed-v1";

export type CargaMasivaSeedPayload = {
  rows: CargaMasivaRow[];
  message?: string;
};

export function readCargaMasivaSeed(): CargaMasivaSeedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PL_CARGA_MASIVA_SEED_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PL_CARGA_MASIVA_SEED_KEY);
    const parsed = JSON.parse(raw) as CargaMasivaSeedPayload;
    if (!parsed?.rows || !Array.isArray(parsed.rows) || parsed.rows.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
