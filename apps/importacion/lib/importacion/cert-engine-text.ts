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

/**
 * Chery ENGINE No: SQRE (Arrizo / Tiggo 2) y SQRF (Tiggo 7 / 1.6T).
 * OCR suele leer O/0 en lugar de Q.
 */
const CHERY_ENGINE_RE = /\b(S[O0Q]R[EF][A-Z0-9]{8,16})\b/gi;

/** Prefijo motor Chery (también pegados: `…60412SQRE4G15C…` / `…SQRF4J16…`). */
const CHERY_ENGINE_PREFIX_RE = /S[O0Q]R[EF]/g;

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
  if (/^S[O0Q]R[EF]/.test(m)) {
    const series = m[3] === "F" ? "F" : "E";
    m = `SQR${series}${m.slice(4)}`;
  }
  if (!/^SQR[EF][A-Z0-9]{8,16}$/.test(m)) return null;
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
      !/\bVIN\b|\bLVV|\bLVT|\bSQR[EF]/i.test(trimmed)
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

export type OcrGlyphBox = {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

/**
 * Toda la columna ENGINE No desde cajas OCR (arriba → abajo).
 * Une fragmentos de la misma fila (`SQRE4G15C` + `B0TC60412`).
 */
export function collectEngineNosFromColumnWords(
  words: readonly OcrGlyphBox[]
): string[] {
  const glyphs = words
    .map((w) => {
      const text = (w.text ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      return {
        text,
        x0: w.x0,
        y0: w.y0,
        x1: w.x1,
        y1: w.y1,
        midX: (w.x0 + w.x1) / 2,
        midY: (w.y0 + w.y1) / 2,
      };
    })
    .filter((w) => w.text.length >= 2);

  const seeds = glyphs.filter(
    (w) => /^S[O0Q]R[EF]/.test(w.text) || /^C16TD/.test(w.text)
  );
  if (seeds.length === 0) {
    return uniqueMotors(glyphs.flatMap((w) => collectEngineNosInOrder(w.text)));
  }

  const xs = seeds.map((s) => s.midX).sort((a, b) => a - b);
  const colX = xs[Math.floor(xs.length / 2)]!;
  const colTol = Math.max(
    48,
    ...seeds.map((s) => s.x1 - s.x0),
    ...seeds.map((s) => Math.abs(s.midX - colX))
  );
  const inCol = glyphs
    .filter((w) => Math.abs(w.midX - colX) <= colTol * 2)
    .sort((a, b) => a.midY - b.midY || a.x0 - b.x0);

  const rowH = Math.max(
    14,
    ...inCol.map((w) => w.y1 - w.y0)
  );
  const rows: (typeof inCol)[] = [];
  for (const w of inCol) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0]!.midY - w.midY) <= rowH * 0.7) {
      last.push(w);
    } else {
      rows.push([w]);
    }
  }

  const motors: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    const joined = row.map((g) => g.text).join("");
    if (/^ENGINE|^VINNO|^COLOUR|^COLOR|^ITEM/.test(joined)) continue;
    motors.push(...collectEngineNosInOrder(joined));
  }
  return uniqueMotors(motors);
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
 * Un lote Chery suele traer 8–18 ENGINE No. Parar a los 2 dejaba el resto
 * de la columna (y las páginas siguientes) sin leer.
 */
export const CERT_HARVEST_OCR_TARGET = 8;

export function certHarvestNeedsMoreOcr(h: CertEngineHarvest): boolean {
  return (
    h.motors.length < CERT_HARVEST_OCR_TARGET &&
    h.pairs.length < CERT_HARVEST_OCR_TARGET
  );
}

/**
 * Flujo del lunes: la tabla ENGINE No está en la pág. 2 del COO.
 * Orden de lectura: 2, 1, 3… (0-based: 1, 0, 2, 3…).
 */
export function orderPdfPageIndexesEngineFirst(pageCount: number): number[] {
  if (pageCount <= 0) return [];
  if (pageCount === 1) return [0];
  return [1, 0, ...Array.from({ length: pageCount - 2 }, (_, i) => i + 2)];
}

export function orderPdfPagesEngineTableFirst<T>(pages: T[]): T[] {
  return orderPdfPageIndexesEngineFirst(pages.length).map((i) => pages[i]!);
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
/**
 * Un VIN (17) o WMI Chery/MAV no es ENGINE No. La factura a veces copia
 * Code/VIN al campo motor y luego el COO no pisa ese valor.
 */
export function isVinLikeSerialMotor(raw: string | null | undefined): boolean {
  const compact = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!compact) return false;
  if (/^S[O0Q]R[EF]/.test(compact) || /^C16TD/.test(compact)) return false;
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) return true;
  if (/^L[VWY]/.test(compact) && compact.length >= 15 && compact.length <= 18) {
    return true;
  }
  if (/^MF3/.test(compact) && compact.length >= 15) return true;
  return false;
}

/** Falta ENGINE No real del certificado (vacío, POR-COMPLETAR o VIN). */
export function rowNeedsCertEngineNo(
  serialMotor: string | null | undefined
): boolean {
  return !normalizeMotor(serialMotor) || isVinLikeSerialMotor(serialMotor);
}

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
    if (!rowNeedsCertEngineNo(row.serialMotor)) return row;
    const rowKey = rowKeys[i];
    if (!rowKey) return row;
    const certVin = rowToCert.get(rowKey);
    if (!certVin) return row;
    const motor = motorByCertVin.get(certVin);
    if (!motor || isVinLikeSerialMotor(motor)) return row;
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
    if (rowNeedsCertEngineNo(row.serialMotor)) continue;
    const m = normalizeMotor(row.serialMotor);
    if (m) used.add(m);
  }
  const leftover = motorsInOrder.filter((m) => {
    const motor = normalizeMotor(m);
    if (!motor || isVinLikeSerialMotor(motor) || used.has(motor)) return false;
    used.add(motor);
    return true;
  });
  let i = 0;
  return rows.map((row) => {
    if (!rowNeedsCertEngineNo(row.serialMotor)) return row;
    if (i >= leftover.length) return row;
    const next = leftover[i++]!;
    return { ...row, serialMotor: next };
  });
}

/**
 * ENGINE No suele estar en la página 2, pero el COO puede ser 1 sola página
 * (o una foto de la tabla VIN + motor).
 */
export function parseCertEngineNosFromPages(pages: string[]): CertEnginePair[] {
  return harvestCertEnginesFromPages(pages).pairs;
}

/** Prefiere pág. 2; si no hay ENGINE No (cert de 1 página), busca en el resto. */
export function harvestCertEnginesFromPages(pages: string[]): CertEngineHarvest {
  if (!pages.length) return { pairs: [], motors: [] };
  if (pages.length === 1) {
    return harvestCertEnginesFromText(pages[0] ?? "");
  }
  const page2 = harvestCertEnginesFromText(pages[1] ?? "");
  if (page2.pairs.length > 0 || page2.motors.length >= 2) return page2;
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
