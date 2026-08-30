/**
 * Emparejado de VIN/chasis entre factura, certificado y nombres de archivo.
 * Sin dependencias de OCR ni de UI.
 */

import { repairCheryWmi } from "./vin-text";

export function normalizeSerialKey(serial: string): string {
  return repairCheryWmi(
    serial.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  );
}

const SERIAL_PREFIX_MIN = 11;
const SUFFIX_LENS = [8, 6] as const;

function uniqueSuffixHit(
  needle: string,
  keys: string[],
  suffixLen: number
): string | null {
  if (needle.length < suffixLen) return null;
  const suf = needle.slice(-suffixLen);
  const hits = keys.filter(
    (k) => k.length >= suffixLen && k.slice(-suffixLen) === suf
  );
  return hits.length === 1 ? hits[0]! : null;
}

/**
 * Empareja VIN exacto, prefijo único (≥11) o sufijo único (8 / 6).
 * El sufijo cubre OCR recortado al inicio y nombres tipo `COO-…3650.pdf`.
 */
export function matchSerialKeyAmong(
  needle: string,
  haystack: string[]
): string | null {
  const n = normalizeSerialKey(needle);
  if (!n) return null;
  const keys = [
    ...new Set(haystack.map((h) => normalizeSerialKey(h)).filter(Boolean)),
  ];
  if (keys.includes(n)) return n;
  if (n.length >= SERIAL_PREFIX_MIN) {
    const hits = keys.filter(
      (k) =>
        k.length >= SERIAL_PREFIX_MIN && (k.startsWith(n) || n.startsWith(k))
    );
    if (hits.length === 1) return hits[0]!;
  }
  for (const len of SUFFIX_LENS) {
    const hit = uniqueSuffixHit(n, keys, len);
    if (hit) return hit;
  }
  return null;
}

/**
 * Empareja filas↔certificados 1:1. Evita copiar un solo motor a todas las
 * unidades. Orden: exacto → prefijo único → sufijo único.
 */
export function pairSerialsOneToOne(
  rowSerials: string[],
  certSerials: string[]
): Map<string, string> {
  const rows = [
    ...new Set(rowSerials.map(normalizeSerialKey).filter(Boolean)),
  ];
  const certs = [
    ...new Set(certSerials.map(normalizeSerialKey).filter(Boolean)),
  ];
  const paired = new Map<string, string>();
  const usedCert = new Set<string>();

  for (const row of rows) {
    if (certs.includes(row) && !usedCert.has(row)) {
      paired.set(row, row);
      usedCert.add(row);
    }
  }

  for (const row of rows) {
    if (paired.has(row) || row.length < SERIAL_PREFIX_MIN) continue;
    const candidates = certs.filter(
      (c) =>
        !usedCert.has(c) &&
        c.length >= SERIAL_PREFIX_MIN &&
        (c.startsWith(row) || row.startsWith(c))
    );
    if (candidates.length === 1) {
      paired.set(row, candidates[0]!);
      usedCert.add(candidates[0]!);
    }
  }

  for (const len of SUFFIX_LENS) {
    for (const row of rows) {
      if (paired.has(row) || row.length < len) continue;
      const suf = row.slice(-len);
      const candidates = certs.filter(
        (c) => !usedCert.has(c) && c.length >= len && c.slice(-len) === suf
      );
      if (candidates.length === 1) {
        paired.set(row, candidates[0]!);
        usedCert.add(candidates[0]!);
      }
    }
  }

  return paired;
}

export function lookupBySerialPrefix<T>(
  map: Map<string, T>,
  serial: string
): T | undefined {
  const n = normalizeSerialKey(serial);
  if (!n) return undefined;
  const matched = matchSerialKeyAmong(n, [...map.keys()]);
  return matched ? map.get(matched) : undefined;
}

export type CertFileMatch = {
  serial: string;
  fileName: string;
};

/**
 * Elige el archivo de certificado que corresponde a un VIN.
 * Prioridad: matches OCR (serial↔fileName) → VIN en el nombre → sufijo único.
 */
export function pickCertFileForSerial<T extends { name: string }>(
  serial: string,
  files: T[],
  matches: CertFileMatch[] = []
): T | null {
  if (files.length === 0) return null;
  const s = normalizeSerialKey(serial);
  if (!s) return files.length === 1 ? files[0]! : null;

  if (matches.length > 0) {
    const paired = pairSerialsOneToOne(
      [s],
      matches.map((m) => m.serial)
    );
    const certSerial = paired.get(s);
    if (certSerial) {
      const match = matches.find(
        (m) => normalizeSerialKey(m.serial) === certSerial
      );
      const byName = match
        ? files.find((f) => f.name === match.fileName)
        : undefined;
      if (byName) return byName;
    }
  }

  const inName = files.filter((f) => {
    const key = normalizeSerialKey(f.name);
    if (!key) return false;
    if (key.includes(s)) return true;
    if (s.length >= SERIAL_PREFIX_MIN && key.includes(s.slice(0, SERIAL_PREFIX_MIN))) {
      return true;
    }
    return false;
  });
  if (inName.length === 1) return inName[0]!;

  for (const len of SUFFIX_LENS) {
    if (s.length < len) continue;
    const suf = s.slice(-len);
    const hits = files.filter((f) =>
      normalizeSerialKey(f.name).includes(suf)
    );
    if (hits.length === 1) return hits[0]!;
  }

  return files.length === 1 ? files[0]! : null;
}
