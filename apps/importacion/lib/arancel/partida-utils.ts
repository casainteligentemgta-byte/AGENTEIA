/** Normaliza HS a 10 dígitos (sin puntos). */
export function normalizePartida10(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 6) return null;
  return digits.padEnd(10, "0").slice(0, 10);
}

export type PartidaArancelariaFuente = "manual" | "reglas" | "ocr";

const PARTIDA_ARANCELARIA_FUENTE_LABELS: Record<PartidaArancelariaFuente, string> =
  {
    manual: "Manual",
    reglas: "Reglas Cap. 87",
    ocr: "OCR documento",
  };

export function formatPartidaFuente(
  fuente: PartidaArancelariaFuente | null | undefined,
  fundamento: string | null | undefined
): string | null {
  const label = fuente ? PARTIDA_ARANCELARIA_FUENTE_LABELS[fuente] : null;
  const fund = fundamento?.trim() || null;
  if (label && fund) return `${label}: ${fund}`;
  return label ?? fund;
}

/** Arancel estimado = CIF × Ad-Valorem %. */
export function estimarArancelAdValoremUsd(
  valorCif: number | null | undefined,
  tarifaPct: number | null | undefined
): number | null {
  if (
    typeof valorCif !== "number" ||
    !Number.isFinite(valorCif) ||
    valorCif < 0 ||
    typeof tarifaPct !== "number" ||
    !Number.isFinite(tarifaPct) ||
    tarifaPct < 0
  ) {
    return null;
  }
  return Math.round(valorCif * (tarifaPct / 100) * 100) / 100;
}
