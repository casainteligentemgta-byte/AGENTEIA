import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import type { CertMatch } from "@/lib/importacion/carga-masiva-ui";
import { vehicleCompleteness } from "@/lib/importacion/carga-masiva-ui";

/** Etapas de extracción multi-documento (Fase B). */
export const CARGA_MASIVA_ETAPAS = ["vins", "datos", "certs"] as const;
export type CargaMasivaEtapaId = (typeof CARGA_MASIVA_ETAPAS)[number];

export const CARGA_MASIVA_ETAPA_LABELS: Record<CargaMasivaEtapaId, string> = {
  vins: "1. Cosechar VIN",
  datos: "2. Enriquecer datos",
  certs: "3. Certificados y BL",
};

export const CARGA_MASIVA_ETAPA_HINTS: Record<CargaMasivaEtapaId, string> = {
  vins: "El servidor está leyendo los VIN. El celular solo consulta el estado.",
  datos: "Completando modelo, color y precios en el servidor…",
  certs: "Aplicando certificados de origen y BL en el servidor…",
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

export function nextCargaMasivaEtapa(
  current: CargaMasivaEtapaId,
  hasCertOrBl: boolean
): CargaMasivaEtapaId | null {
  if (current === "vins") return "datos";
  if (current === "datos") return hasCertOrBl ? "certs" : null;
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
