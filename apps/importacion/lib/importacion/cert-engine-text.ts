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

/** VIN pegado al ENGINE No (página 2), sin saltar a otro vehículo. */
const VIN_ENGINE_PAIR_RE =
  /\b(L[VWY][A-HJ-NPR-Z0-9]{13,16}|MF3[A-HJ-NPR-Z0-9]{14})\b(?:[^\nA-Z]{0,12}|[ \t]{1,8})(?:ENGINE\s*(?:SERIAL\s*)?(?:NO|N[°º.]|NUMBER|#)?\.?\s*[:#]?\s*)?([A-Z0-9\-]{6,20})/gi;

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

/** VIN + color + ENGINE No en la misma fila, aunque no se repita la etiqueta. */
function pairVinThenMotorOnSameLine(text: string): CertEnginePair[] {
  const pairs: CertEnginePair[] = [];
  for (const line of text.split(/\r?\n/)) {
    VIN_TOKEN_RE.lastIndex = 0;
    const vinMatch = VIN_TOKEN_RE.exec(line.toUpperCase());
    if (!vinMatch) continue;
    const vin = resolveVinToken(vinMatch[1]);
    if (!vin) continue;
    const after = line.slice(vinMatch.index + vinMatch[0].length);
    const labeled = extractLabeledMotors(after);
    if (labeled[0]) {
      pairs.push({ vin, serialMotor: labeled[0] });
      continue;
    }
    for (const tok of after.split(/[\s,;|]+/)) {
      const motor = plausibleMotor(tok);
      if (!motor) continue;
      pairs.push({ vin, serialMotor: motor });
      break;
    }
  }
  return pairs;
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

  for (const m of compact.matchAll(VIN_ENGINE_PAIR_RE)) {
    const vin = salvageCheryVin(m[1]);
    const motor = plausibleMotor(m[2]);
    if (vin && motor) byVin.set(vin, motor);
  }

  const vins = collectVins(text);
  const headerMotors = extractMotorsUnderEngineHeader(text);
  const labeledMotors = extractLabeledMotors(compact);
  const motors =
    headerMotors.length === vins.length && vins.length > 0
      ? headerMotors
      : labeledMotors;
  if (vins.length > 0 && motors.length === vins.length) {
    vins.forEach((vin, i) => byVin.set(vin, motors[i]!));
  }

  return [...byVin.entries()].map(([vin, serialMotor]) => ({ vin, serialMotor }));
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
