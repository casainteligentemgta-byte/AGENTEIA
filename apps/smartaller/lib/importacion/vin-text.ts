/** Utilidades VIN sin dependencias de extractores (evita ciclos de import). */

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export function compactAlnumVin(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** VIN: 17 chars, sin I/O/Q. */
export function normalizeVinLoose(raw: string | null | undefined): string | null {
  let v = compactAlnumVin(raw);
  if (!v) return null;
  v = v.replace(/[IOQ]/g, (ch) => (ch === "O" ? "0" : ch === "I" ? "1" : "0"));
  if (v.length !== 17) return v.length >= 11 ? v : null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return null;
  return v;
}

/** Extrae VIN de 17 chars desde texto libre (JSON truncado, OCR, etc.). */
export function extractVinStringsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.toUpperCase().matchAll(VIN_RE)) {
    const vin = normalizeVinLoose(m[1]);
    if (vin && vin.length === 17) found.add(vin);
  }
  return [...found];
}
