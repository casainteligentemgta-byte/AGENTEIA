/** Utilidades VIN sin dependencias de extractores (evita ciclos de import). */

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export function compactAlnumVin(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Repara WMI Chery típicos del OCR (LWV/LVW → LVV). */
export function repairCheryWmi(vin: string): string {
  const v = vin.toUpperCase();
  if (/^LWV|^LV[WY]|^LYV|^LWW/.test(v)) return `LVV${v.slice(3)}`;
  return v;
}

/**
 * VIN: 17 chars, sin I/O/Q.
 * `strict: true` descarta longitudes ≠ 17 (carga masiva).
 * Sin strict, conserva parciales ≥11 para diagnóstico OCR.
 */
export function normalizeVinLoose(
  raw: string | null | undefined,
  options?: { strict?: boolean }
): string | null {
  let v = compactAlnumVin(raw);
  if (!v) return null;
  v = repairCheryWmi(v);
  v = v.replace(/[IOQ]/g, (ch) => (ch === "O" ? "0" : ch === "I" ? "1" : "0"));
  if (v.length !== 17) {
    if (options?.strict) return null;
    return v.length >= 11 ? v : null;
  }
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return null;
  return v;
}

/**
 * Prefiere el VIN de 17 caracteres. El OCR de factura a menudo recorta
 * el chasis; el certificado suele traer el completo.
 */
export function preferCompleteVin(
  current: string | null | undefined,
  incoming: string | null | undefined
): string {
  const currentStrict = normalizeVinLoose(current, { strict: true });
  const incomingStrict = normalizeVinLoose(incoming, { strict: true });
  if (incomingStrict && !currentStrict) return incomingStrict;
  if (currentStrict) return currentStrict;
  const currentLoose = normalizeVinLoose(current, { strict: false }) ?? compactAlnumVin(current);
  const incomingLoose =
    normalizeVinLoose(incoming, { strict: false }) ?? compactAlnumVin(incoming);
  if (incomingLoose && incomingLoose.length > currentLoose.length) return incomingLoose;
  return currentLoose || incomingLoose;
}

/** Extrae VIN de 17 chars desde texto libre (JSON truncado, OCR, etc.). */
export function extractVinStringsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.toUpperCase().matchAll(VIN_RE)) {
    const vin = normalizeVinLoose(m[1], { strict: true });
    if (vin) found.add(vin);
  }
  return [...found];
}
