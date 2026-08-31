/** Utilidades VIN sin dependencias de extractores (evita ciclos de import). */

const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

export function compactAlnumVin(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Repara WMI Chery típicos del OCR (LWV/LVW/LWW/LYV → LVV). */
export function repairCheryWmi(vin: string): string {
  const v = vin.toUpperCase();
  if (/^LWV|^LV[WY]|^LYV|^LWW/.test(v)) return `LVV${v.slice(3)}`;
  return v;
}

const CHERY_VIN_BODY_RE = /^LVVD[CB]21[A-HJ-NPR-Z0-9]{2}V[DE][0-9]{6}$/;

function finalizeCheryCandidate(raw: string): string | null {
  const x = raw.replace(/[IOQ]/g, (ch) =>
    ch === "O" ? "0" : ch === "I" ? "1" : "0"
  );
  if (x.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(x)) return null;
  if (CHERY_VIN_BODY_RE.test(x)) return x;
  if (/^LV[VTD]/.test(x) && /V[DE][0-9]{6}$/.test(x)) return x;
  return null;
}

/**
 * Reconstruye VIN Chery de factura (columna Code) cuando el PDF/OCR
 * come una letra (16 chars) o lee LVV como LWV/LWD/LVD.
 */
export function salvageCheryVin(raw: string | null | undefined): string | null {
  const v = compactAlnumVin(raw);
  if (!v || v.length < 15 || v.length > 18) return null;
  if (!/^L[VWY]/.test(v)) return null;

  const direct = finalizeCheryCandidate(repairCheryWmi(v));
  if (direct) return direct;

  // 16 chars: LVD… / LWD… = WMI sin la 2ª V (LVV + D…)
  if (v.length === 16 && /^L[VWD]D/.test(v)) {
    let x = `LVV${v.slice(2)}`;
    if (/^LVVD8/.test(x)) x = `LVVDB${x.slice(5)}`;
    const ok = finalizeCheryCandidate(x);
    if (ok) return ok;
  }

  // 17 chars pegados al color (LVD… + 1ª letra de CELADON/NASDAQ)
  if (v.length === 17 && /^L[VWD]D/.test(v) && !v.startsWith("LVV")) {
    return salvageCheryVin(v.slice(0, 16));
  }

  if (v.length === 18) {
    return salvageCheryVin(v.slice(0, 17)) ?? salvageCheryVin(v.slice(0, 16));
  }

  return null;
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
  const salvaged = salvageCheryVin(v);
  if (salvaged) return salvaged;
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
  // Factura Chery: Code a veces sale con 16 chars o WMI LWV/LWD
  for (const m of text.toUpperCase().matchAll(/\b(L[VWY][A-HJ-NPR-Z0-9]{13,16})\b/g)) {
    const vin = salvageCheryVin(m[1]);
    if (vin) found.add(vin);
  }
  return [...found];
}

/** Año del modelo según dígito 10 del VIN (ciclo 2010–2039). Sin canvas. */
export function anioFromVin(vin: string | null | undefined): number | null {
  const v = (vin ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (v.length < 10) return null;
  const code = v[9]!;
  const map: Record<string, number> = {
    A: 2010,
    B: 2011,
    C: 2012,
    D: 2013,
    E: 2014,
    F: 2015,
    G: 2016,
    H: 2017,
    J: 2018,
    K: 2019,
    L: 2020,
    M: 2021,
    N: 2022,
    P: 2023,
    R: 2024,
    S: 2025,
    T: 2026,
    V: 2027,
    W: 2028,
    X: 2029,
    Y: 2030,
    "1": 2031,
    "2": 2032,
    "3": 2033,
    "4": 2034,
    "5": 2035,
    "6": 2036,
    "7": 2037,
    "8": 2038,
    "9": 2039,
  };
  return map[code] ?? null;
}
