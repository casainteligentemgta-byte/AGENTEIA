/**
 * ENGINE No / serial motor en certificado de origen (a menudo página 2).
 * La factura comercial no trae esta columna; el serial motor sale del COO.
 */

import { normalizeMotor } from "./factura-row-fidelity";
import {
  extractVinStringsFromText,
  salvageCheryVin,
} from "./vin-text";

export type CertEnginePair = {
  vin: string;
  serialMotor: string;
};

const ENGINE_LABELED_RE =
  /ENGINE\s*(?:SERIAL\s*)?(?:NO|N[°º.]|NUMBER|#)?\.?\s*[:#]?\s*([A-Z0-9\-]{6,20})/gi;

const ENGINE_HEADER_RE = /\bENGINE\s*(?:SERIAL\s*)?(?:NO|N[°º.]|NUMBER|#)\b/i;

const VIN_TOKEN_RE = /\b(L[VWY][A-HJ-NPR-Z0-9]{13,16}|MF3[A-HJ-NPR-Z0-9]{14})\b/g;

const SECTION_STOP_RE =
  /^(DESCRIPTION|MARKS\s*&?\s*NOS|QUANTITY|GROSS|NET\s*WEIGHT|MEASUREMENT|PACKAGE|PACKAGES|REMARKS|TOTAL|CONSIGNEE|SHIPPER)\b/i;

function resolveVinToken(raw: string): string | null {
  const salvaged = salvageCheryVin(raw);
  if (salvaged) return salvaged;
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) {
    return compact;
  }
  return null;
}

function isVinLike(raw: string): boolean {
  const v = salvageCheryVin(raw);
  if (v) return true;
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return compact.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(compact);
}

function plausibleMotor(raw: string | null | undefined): string | null {
  const motor = normalizeMotor(raw);
  if (!motor) return null;
  if (isVinLike(motor)) return null;
  if (
    /TIGGO|ARRIZO|CHERY|SILVER|GRAY|GREY|WHITE|BLACK|NASDAQ|CELADON|KHAKI/.test(
      motor
    )
  ) {
    return null;
  }
  if (!/[A-Z]/i.test(motor) || !/\d/.test(motor)) return null;
  return motor;
}

function collectVins(text: string): string[] {
  const found = new Set<string>();
  for (const vin of extractVinStringsFromText(text)) found.add(vin);
  for (const m of text.toUpperCase().matchAll(VIN_TOKEN_RE)) {
    const vin = salvageCheryVin(m[1]);
    if (vin) found.add(vin);
  }
  return [...found];
}

function extractLabeledMotors(text: string): string[] {
  return [...text.toUpperCase().matchAll(ENGINE_LABELED_RE)]
    .map((m) => plausibleMotor(m[1]))
    .filter((m): m is string => Boolean(m));
}

/** Columna `ENGINE No` / `ENGINE NO`: un encabezado y N seriales debajo. */
function extractMotorsUnderEngineHeader(text: string): string[] {
  const out: string[] = [];
  let collecting = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (ENGINE_HEADER_RE.test(trimmed)) {
      collecting = true;
      out.push(...extractLabeledMotors(trimmed));
      continue;
    }
    if (!collecting) continue;
    if (SECTION_STOP_RE.test(trimmed)) {
      collecting = false;
      continue;
    }
    for (const tok of trimmed.split(/[\s,;|]+/)) {
      const motor = plausibleMotor(tok);
      if (motor) out.push(motor);
    }
  }
  return out;
}

function firstPlausibleMotorIn(text: string): string | null {
  const labeled = extractLabeledMotors(text);
  if (labeled[0]) return labeled[0];
  for (const tok of text.split(/[\s,;|]+/)) {
    const motor = plausibleMotor(tok);
    if (motor) return motor;
  }
  return null;
}

function lineHasVin(line: string): boolean {
  VIN_TOKEN_RE.lastIndex = 0;
  return VIN_TOKEN_RE.test(line.toUpperCase());
}

/** Motor suelto en la línea de abajo; no confundir con un bloque `ENGINE NO` listado. */
function loneMotorOnFollowingLine(nextLine: string): string | null {
  const next = nextLine.trim();
  if (!next || lineHasVin(next) || ENGINE_HEADER_RE.test(next)) return null;
  const tokens = next.split(/[\s,;|]+/).filter(Boolean);
  if (tokens.length > 3) return null;
  const motors = tokens
    .map((tok) => plausibleMotor(tok))
    .filter((m): m is string => Boolean(m));
  return motors.length === 1 ? motors[0]! : null;
}

/**
 * VIN + motor en la misma fila, o el motor solo en la línea siguiente
 * (OCR de la 1ª fila: el serial queda bajo el encabezado ENGINE No).
 */
function pairVinThenMotorOnSameLine(text: string): CertEnginePair[] {
  const lines = text.split(/\r?\n/);
  const pairs: CertEnginePair[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    VIN_TOKEN_RE.lastIndex = 0;
    const vinMatch = VIN_TOKEN_RE.exec(line.toUpperCase());
    if (!vinMatch) continue;
    const vin = resolveVinToken(vinMatch[1]);
    if (!vin) continue;
    const after = line.slice(vinMatch.index + vinMatch[0].length);
    let motor = firstPlausibleMotorIn(after);
    if (!motor) {
      motor = loneMotorOnFollowingLine(lines[i + 1] ?? "");
    }
    if (motor) pairs.push({ vin, serialMotor: motor });
  }
  return pairs;
}

function uniqueMotors(motors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of motors) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function assignLeftoverMotors(
  vins: string[],
  byVin: Map<string, string>,
  motors: string[]
): void {
  const used = new Set(byVin.values());
  const leftover = motors.filter((m) => {
    if (used.has(m)) return false;
    used.add(m);
    return true;
  });
  let i = 0;
  for (const vin of vins) {
    if (byVin.has(vin)) continue;
    if (i >= leftover.length) break;
    byVin.set(vin, leftover[i++]!);
  }
}

/**
 * Empareja VIN + ENGINE No desde texto del certificado (página 1 y 2).
 */
export function parseCertEngineNosFromText(text: string): CertEnginePair[] {
  if (!text?.trim()) return [];
  const compact = text.toUpperCase().replace(/\s+/g, " ");
  const byVin = new Map<string, string>();

  for (const pair of pairVinThenMotorOnSameLine(text)) {
    byVin.set(pair.vin, pair.serialMotor);
  }

  const vins = collectVins(text);
  const motors = uniqueMotors([
    ...extractMotorsUnderEngineHeader(text),
    ...extractLabeledMotors(compact),
    ...byVin.values(),
  ]);
  assignLeftoverMotors(vins, byVin, motors);

  return vins
    .filter((vin) => byVin.has(vin))
    .map((vin) => ({ vin, serialMotor: byVin.get(vin)! }));
}

/** Seriales de la columna ENGINE No, en el orden de la página 2. */
export function collectEngineNosInOrder(text: string): string[] {
  if (!text?.trim()) return [];
  return uniqueMotors([
    ...extractMotorsUnderEngineHeader(text),
    ...extractLabeledMotors(text),
  ]);
}

/**
 * Si el VIN del COO no coincide con el de la factura, reparte los ENGINE No
 * huérfanos en el mismo orden de las filas (1ª fila ← 1er motor, etc.).
 */
export function assignEngineNosByRowOrder<T extends { serialMotor?: string }>(
  rows: T[],
  motorsInOrder: string[]
): T[] {
  const used = new Set<string>();
  for (const row of rows) {
    const m = normalizeMotor(row.serialMotor);
    if (m) used.add(m);
  }
  const leftover = motorsInOrder.filter((m) => {
    const motor = normalizeMotor(m);
    if (!motor || used.has(motor)) return false;
    used.add(motor);
    return true;
  });
  let i = 0;
  return rows.map((row) => {
    if (normalizeMotor(row.serialMotor)) return row;
    if (i >= leftover.length) return row;
    const next = leftover[i++]!;
    return { ...row, serialMotor: next };
  });
}

/**
 * La columna ENGINE No está en la página 2 del certificado.
 * Si esa página tiene pares, no mezclar con la carátula.
 */
export function parseCertEngineNosFromPages(pages: string[]): CertEnginePair[] {
  const page2 = pages[1]?.trim() ?? "";
  if (page2) {
    const fromPage2 = parseCertEngineNosFromText(page2);
    if (fromPage2.length > 0) return fromPage2;
  }
  return parseCertEngineNosFromText(pages.filter(Boolean).join("\n\n"));
}
