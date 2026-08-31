import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import type { CertMatch } from "@/lib/importacion/carga-masiva-ui";
import { vehicleCompleteness } from "@/lib/importacion/carga-masiva-ui";

/** Etapas de extracción multi-documento (Fase B). */
export const CARGA_MASIVA_ETAPAS = ["vins", "certs", "datos"] as const;
export type CargaMasivaEtapaId = (typeof CARGA_MASIVA_ETAPAS)[number];

export const CARGA_MASIVA_ETAPA_LABELS: Record<CargaMasivaEtapaId, string> = {
  vins: "1. Cosechar VIN",
  certs: "2. Certificados y BL (ENGINE No)",
  datos: "3. Enriquecer datos",
};

export const CARGA_MASIVA_ETAPA_HINTS: Record<CargaMasivaEtapaId, string> = {
  vins: "OCR de la factura completa (VIN, consignatario, destino, CIF) + Gemini si hace falta.",
  datos: "IA + parser: modelo, color, CIF, consignatario, destino y nº factura.",
  certs: "Certificado (PDF o foto, 1 o 2 páginas): ENGINE No al lado del VIN.",
};

export type CargaMasivaEtapaProgress = {
  etapa: CargaMasivaEtapaId;
  label: string;
  hint: string;
  vinsEncontrados: number;
  filasCompletas: number;
  totalFilas: number;
  /** 0–100 orientativo dentro de la etapa actual. */
  pct: number;
};

export type CargaMasivaEtapaResult = {
  etapa: CargaMasivaEtapaId;
  nextEtapa: CargaMasivaEtapaId | null;
  rows: CargaMasivaRow[];
  warnings: string[];
  certMatches: CertMatch[];
  progress: CargaMasivaEtapaProgress;
};

/** Orden fijo: VIN → ENGINE No (si hay cert/BL) → modelo/color/CIF. */
export function cargaMasivaEtapasPlan(
  hasCertOrBl: boolean
): CargaMasivaEtapaId[] {
  return hasCertOrBl ? ["vins", "certs", "datos"] : ["vins", "datos"];
}

export function nextCargaMasivaEtapa(
  current: CargaMasivaEtapaId,
  hasCertOrBl: boolean
): CargaMasivaEtapaId | null {
  if (current === "vins") return hasCertOrBl ? "certs" : "datos";
  if (current === "certs") return "datos";
  return null;
}

export function buildEtapaProgress(
  etapa: CargaMasivaEtapaId,
  rows: CargaMasivaRow[],
  pct: number
): CargaMasivaEtapaProgress {
  const vinsEncontrados = rows.filter(
    (r) => (r.serialCarroceria || r.vin || "").trim().length >= 11
  ).length;
  const filasCompletas = rows.filter((r) => vehicleCompleteness(r).complete)
    .length;
  return {
    etapa,
    label: CARGA_MASIVA_ETAPA_LABELS[etapa],
    hint: CARGA_MASIVA_ETAPA_HINTS[etapa],
    vinsEncontrados,
    filasCompletas,
    totalFilas: rows.length,
    pct: Math.max(0, Math.min(100, Math.round(pct))),
  };
}
