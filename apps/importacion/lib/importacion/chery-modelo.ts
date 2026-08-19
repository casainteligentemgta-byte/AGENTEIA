/**
 * Utilidades Chery puras (seguras para client components).
 * No importar canvas / OCR aquí.
 */

import { compactAlnumVin } from "@/lib/importacion/vin-text";

/** Fragmentos de modelo Chery que el OCR mete en la columna Color. */
const MODELO_EN_COLOR_RE =
  /^(PRO(\s*MAX)?|MAX|TIGGO(\s*\d+)?(\s*PRO)?(\s*MAX)?|ARRIZO(\s*\d+)?(\s*PRO)?|7\s*PRO(\s*MAX)?|8\s*PRO)$/i;

export function isModeloFragmentInColor(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t) return false;
  return MODELO_EN_COLOR_RE.test(t);
}

/**
 * Normaliza modelo comercial Chery a partir de fragmentos OCR
 * ("7 pro", "PRO MAX", "TIGGO 7 PRO").
 */
export function inferCheryModelo(
  modelo: string | null | undefined,
  colorMaybeModelo?: string | null
): string | null {
  const parts = [modelo, colorMaybeModelo]
    .map((x) => (x ?? "").trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (parts.length === 0) return null;
  const joined = parts.join(" ").toUpperCase();

  if (/TIGGO\s*8|8\s*PRO/.test(joined)) {
    if (/PRO\s*MAX|\bMAX\b/.test(joined)) return "Tiggo 8 Pro Max";
    if (/PRO/.test(joined)) return "Tiggo 8 Pro";
    return "Tiggo 8";
  }
  if (
    /TIGGO\s*7|7\s*PRO|\b7\b/.test(joined) ||
    (/PRO\s*MAX/.test(joined) && !/TIGGO\s*[248]/.test(joined))
  ) {
    if (/PRO\s*MAX|\bMAX\b/.test(joined)) return "Tiggo 7 Pro Max";
    if (/PRO/.test(joined) || /\b7\b/.test(joined)) return "Tiggo 7 Pro";
    return "Tiggo 7";
  }
  if (/TIGGO\s*4/.test(joined)) return "Tiggo 4";
  if (/TIGGO\s*2/.test(joined)) return "Tiggo 2";
  if (/ARRIZO\s*8/.test(joined)) return "Arrizo 8";
  if (/ARRIZO\s*5|ARRIZO/.test(joined)) return "Arrizo 5";
  if (/TIGGO/.test(joined)) return parts[0]!;

  const first = parts[0]!;
  if (isModeloFragmentInColor(first) && !/tiggo|arrizo/i.test(first)) {
    return inferCheryModelo(`Tiggo ${first}`, null);
  }
  return first;
}

export function looksLikeCheryVin(vin: string | null | undefined): boolean {
  const v = compactAlnumVin(vin);
  return /^LVV|^LVT|^LVD/.test(v);
}

/** OCR suele poner Tiggo/Arrizo en la columna Marca en lugar de Chery. */
export function looksLikeCheryModelName(
  raw: string | null | undefined
): boolean {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!t || /^chery$/i.test(t)) return false;
  if (/^(TIGGO|ARRIZO|OMODA|QQ)\b/i.test(t)) return true;
  return isModeloFragmentInColor(t);
}

/** Corrige marca=modelo Chery (ej. Marca «Tiggo» → Marca «Chery», Modelo «Tiggo 2»). */
export function repairCheryMarcaModelo(
  marcaRaw: string | null | undefined,
  modeloRaw: string | null | undefined
): { marca: string; modelo: string } {
  const marca = (marcaRaw ?? "").trim();
  const modelo = (modeloRaw ?? "").trim();

  if (/^cherr?y$/i.test(marca)) {
    return {
      marca: "Chery",
      modelo: inferCheryModelo(modelo, null) || modelo,
    };
  }

  if (looksLikeCheryModelName(marca)) {
    const inferred =
      inferCheryModelo(marca, modelo || null) ||
      inferCheryModelo(modelo, marca) ||
      marca;
    return { marca: "Chery", modelo: inferred || modelo || marca };
  }

  return { marca, modelo };
}
