/**
 * ENGINE No / serial motor en certificado de origen (a menudo página 2).
 * La factura comercial no trae esta columna; el serial motor sale del COO.
 */

import { normalizeMotor } from "./factura-row-fidelity";
import { normalizeSerialKey, pairSerialsOneToOne } from "./serial-match";
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

/** Chery Tiggo 2 Pro: ENGINE No al lado del VIN (pág. 2 del COO). */
const CHERY_ENGINE_RE = /\b(S[O0Q]RE[A-Z0-9]{8,16})\b/gi;

/** Prefijo motor Chery (también pegados: `…60412SQRE4G15C…`). */
const CHERY_ENGINE_PREFIX_RE = /S[O0Q]RE/g;

const VIN_TOKEN_RE = /\b(L[VWY][A-HJ-NPR-Z0-9]{13,16}|MF3[A-HJ-NPR-Z0-9]{14})\b/g;

/** `matchAll` / `test` de un regex /g reutilizan `lastIndex` y se saltan filas. */
function matchAllReset(re: RegExp, text: string): RegExpExecArray[] {
  return [...text.matchAll(new RegExp(re.source, re.flags))];
}

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

function salvageCheryEngine(raw: string | null | undefined): string | null {
  const compact = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length < 10) return null;
  let m = compact;
  if (/^S[O0Q]RE/.test(m)) m = `SQRE${m.slice(4)}`;
  if (!/^SQRE[A-Z0-9]{8,16}$/.test(m)) return null;
  return m;
}

function plausibleMotor(raw: string | null | undefined): string | null {
  const chery = salvageCheryEngine(raw);
  if (chery) return chery;
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
  for (const m of matchAllReset(VIN_TOKEN_RE, text.toUpperCase())) {
    const vin = salvageCheryVin(m[1]);
    if (vin) found.add(vin);
  }
  return [...found];
}

function extractLabeledMotors(text: string): string[] {
  return matchAllReset(ENGINE_LABELED_RE, text.toUpperCase())
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
    // DESCRIPTION/COLOUR son columnas de la misma tabla: no cortar la lista.
    if (
      SECTION_STOP_RE.test(trimmed) &&
      !extractCheryEngines(trimmed).length &&
      !/\bVIN\b|\bLVV|\bSQRE/i.test(trimmed)
    ) {
      collecting = false;
      continue;
    }
    for (const tok of trimmed.split(/[\s,;|]+/)) {
      const motor = plausibleMotor(tok);
      if (motor) out.push(motor);
      else out.push(...splitGluedCheryEngines(tok));
    }
  }
  return out;
}

function extractCheryEngines(text: string): string[] {
  const upper = text.toUpperCase();
  const fromWords = matchAllReset(CHERY_ENGINE_RE, upper)
    .map((m) => salvageCheryEngine(m[1]))
    .filter((m): m is string => Boolean(m));
  return uniqueMotors([...fromWords, ...splitGluedCheryEngines(upper)]);
}

/**
 * Parte motores pegados (`…60412SQRE4G15C…`).
 * No compacta todo el documento: eso une un SQRE con el VIN de la fila siguiente.
 */
function splitGluedCheryEngines(text: string): string[] {
  const compact = text.replace(/[^A-Z0-9]/g, "");
  const starts = matchAllReset(CHERY_ENGINE_PREFIX_RE, compact).map(
    (m) => m.index ?? 0
  );
  const out: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]!;
    const next = starts[i + 1];
    if (next != null) {
      const gap = next - start;
      if (gap >= 14 && gap <= 18) {
        const salvaged = salvageCheryEngine(compact.slice(start, next));
        if (salvaged) out.push(salvaged);
      }
      continue;
    }
    const rest = compact.slice(start);
    if (rest.length <= 18 && !/L[VWY]/.test(rest.slice(4))) {
      const salvaged = salvageCheryEngine(rest);
      if (salvaged) out.push(salvaged);
    }
  }
  return out;
}

function firstPlausibleMotorIn(text: string): string | null {
  const chery = extractCheryEngines(text);
  if (chery[0]) return chery[0];
  const labeled = extractLabeledMotors(text);
  if (labeled[0]) return labeled[0];
  for (const tok of text.split(/[\s,;|]+/)) {
    const motor = plausibleMotor(tok);
    if (motor) return motor;
  }
  return null;
}

function lineHasVin(line: string): boolean {
  return new RegExp(VIN_TOKEN_RE.source, VIN_TOKEN_RE.flags).test(
    line.toUpperCase()
  );
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
    const upper = line.toUpperCase();
    const vinMatches = matchAllReset(VIN_TOKEN_RE, upper);
    if (vinMatches.length === 0) continue;
    const lineVins = vinMatches
      .map((m) => resolveVinToken(m[1]))
      .filter((v): v is string => Boolean(v));
    const lineMotors = extractCheryEngines(upper);
    if (lineVins.length >= 2 && lineMotors.length === lineVins.length) {
      for (let z = 0; z < lineVins.length; z++) {
        pairs.push({ vin: lineVins[z]!, serialMotor: lineMotors[z]! });
      }
      continue;
    }
    for (let v = 0; v < vinMatches.length; v++) {
      const vinMatch = vinMatches[v]!;
      const vin = resolveVinToken(vinMatch[1]);
      if (!vin) continue;
      const start = (vinMatch.index ?? 0) + vinMatch[0].length;
      const end = vinMatches[v + 1]?.index ?? upper.length;
      const after = upper.slice(start, end);
      let motor = firstPlausibleMotorIn(after);
      if (!motor && v === vinMatches.length - 1) {
        motor = loneMotorOnFollowingLine(lines[i + 1] ?? "");
      }
      if (motor) pairs.push({ vin, serialMotor: motor });
    }
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
    ...extractCheryEngines(text),
    ...byVin.values(),
  ]);
  assignLeftoverMotors(vins, byVin, motors);

  // OCR aplanó la tabla: 1 par y el resto de motores sueltos.
  if (byVin.size <= 1 && motors.length >= 2 && vins.length >= 2) {
    byVin.clear();
    assignLeftoverMotors(vins, byVin, motors);
  }

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
    ...extractCheryEngines(text),
  ]);
}

/**
 * Siguiente ENGINE No en orden de lectura que aún no está en `already`.
 * Un recorte OCR = un serial (llenar el 1º, releer debajo, pegar el 2º…).
 */
export function firstUnusedEngineNo(
  text: string,
  already: readonly string[]
): string | null {
  const used = new Set(already.map((m) => m.toUpperCase()));
  for (const motor of collectEngineNosInOrder(text)) {
    if (!used.has(motor.toUpperCase())) return motor;
  }
  return null;
}

/** Aplica ventanas OCR sucesivas: cada una aporta como máximo el siguiente serial. */
export function accumulateEngineNosSequentially(
  windows: readonly string[]
): string[] {
  const out: string[] = [];
  for (const window of windows) {
    const next = firstUnusedEngineNo(window, out);
    if (next) out.push(next);
  }
  return out;
}

export type CertEngineHarvest = {
  pairs: CertEnginePair[];
  motors: string[];
};

/** Pares VIN↔motor y columna ENGINE No desde una página (texto embebido u OCR). */
export function harvestCertEnginesFromText(text: string): CertEngineHarvest {
  if (!text?.trim()) return { pairs: [], motors: [] };
  const pairs = parseCertEngineNosFromText(text);
  const motors = uniqueMotors([
    ...pairs.map((p) => p.serialMotor),
    ...collectEngineNosInOrder(text),
  ]);
  return { pairs, motors };
}

export function scoreCertEngineHarvest(h: CertEngineHarvest): number {
  return h.pairs.length * 10 + h.motors.length;
}

/**
 * Un solo ENGINE No no basta: el resto está en la misma columna
 * (cuadro vertical o apaisado). Hay que seguir con OCR.
 */
export function certHarvestNeedsMoreOcr(h: CertEngineHarvest): boolean {
  return h.motors.length <= 1 && h.pairs.length <= 1;
}

export function mergeCertEngineHarvests(
  ...parts: CertEngineHarvest[]
): CertEngineHarvest {
  const pairByVin = new Map<string, string>();
  const motors: string[] = [];
  for (const part of parts) {
    for (const pair of part.pairs) {
      if (!pairByVin.has(pair.vin)) pairByVin.set(pair.vin, pair.serialMotor);
    }
    motors.push(...part.motors);
  }
  return {
    pairs: [...pairByVin.entries()].map(([vin, serialMotor]) => ({
      vin,
      serialMotor,
    })),
    motors: uniqueMotors(motors),
  };
}

/**
 * Cruza ENGINE No del certificado con las filas de factura por VIN
 * (exacto, prefijo o sufijo; repara LWV→LVV).
 */
export function applyEngineNosByVin<
  T extends { vin?: string; serialCarroceria?: string; serialMotor?: string },
>(rows: T[], pairs: CertEnginePair[]): T[] {
  if (pairs.length === 0 || rows.length === 0) return rows;
  const rowKeys = rows.map((r) =>
    normalizeSerialKey(r.serialCarroceria || r.vin || "")
  );
  const rowToCert = pairSerialsOneToOne(
    rowKeys,
    pairs.map((p) => p.vin)
  );
  const motorByCertVin = new Map(
    pairs.map((p) => [normalizeSerialKey(p.vin), p.serialMotor] as const)
  );
  return rows.map((row, i) => {
    if (normalizeMotor(row.serialMotor)) return row;
    const rowKey = rowKeys[i];
    if (!rowKey) return row;
    const certVin = rowToCert.get(rowKey);
    if (!certVin) return row;
    const motor = motorByCertVin.get(certVin);
    if (!motor) return row;
    return { ...row, serialMotor: motor };
  });
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
  return harvestCertEnginesFromPages(pages).pairs;
}

/** Prefiere pág. 2; si no hay ENGINE No, busca en el resto del PDF. */
export function harvestCertEnginesFromPages(pages: string[]): CertEngineHarvest {
  if (!pages.length) return { pairs: [], motors: [] };
  const page2 = harvestCertEnginesFromText(pages[1] ?? "");
  if (page2.pairs.length > 0) return page2;
  let best = page2;
  for (let i = 0; i < pages.length; i++) {
    if (i === 1) continue;
    const harvested = harvestCertEnginesFromText(pages[i] ?? "");
    if (scoreCertEngineHarvest(harvested) > scoreCertEngineHarvest(best)) {
      best = harvested;
    }
  }
  if (best.pairs.length > 0 || best.motors.length > 0) return best;
  return harvestCertEnginesFromText(pages.filter(Boolean).join("\n\n"));
}
