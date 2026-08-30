/**
 * ENGINE No / serial motor en certificado de origen (a menudo página 2).
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

const VIN_TOKEN_RE = /\b(L[VWY][A-HJ-NPR-Z0-9]{13,16}|MF3[A-HJ-NPR-Z0-9]{14})\b/g;

/** VIN pegado al ENGINE No (página 2), sin saltar a otro vehículo. */
const VIN_ENGINE_PAIR_RE =
  /\b(L[VWY][A-HJ-NPR-Z0-9]{13,16}|MF3[A-HJ-NPR-Z0-9]{14})\b(?:[^\nA-Z]{0,12}|[ \t]{1,8})(?:ENGINE\s*(?:SERIAL\s*)?(?:NO|N[°º.]|NUMBER|#)?\.?\s*[:#]?\s*)?([A-Z0-9\-]{6,20})/gi;

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

/**
 * Empareja VIN + ENGINE No desde texto del certificado (página 1 y 2).
 */
export function parseCertEngineNosFromText(text: string): CertEnginePair[] {
  if (!text?.trim()) return [];
  const compact = text.toUpperCase().replace(/\s+/g, " ");
  const byVin = new Map<string, string>();

  for (const m of compact.matchAll(VIN_ENGINE_PAIR_RE)) {
    const vin = salvageCheryVin(m[1]);
    const motor = plausibleMotor(m[2]);
    if (vin && motor) byVin.set(vin, motor);
  }

  const vins = collectVins(text);
  const motors = [...compact.matchAll(ENGINE_LABELED_RE)]
    .map((m) => plausibleMotor(m[1]))
    .filter((m): m is string => Boolean(m));
  // Página 2 típica: lista de VIN y luego lista de ENGINE NO (mismo orden).
  if (vins.length > 0 && motors.length === vins.length) {
    vins.forEach((vin, i) => byVin.set(vin, motors[i]!));
  }

  return [...byVin.entries()].map(([vin, serialMotor]) => ({ vin, serialMotor }));
}
