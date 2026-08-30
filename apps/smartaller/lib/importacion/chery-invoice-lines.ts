/**
 * Parser determinista de factura Chery / Intercontinental:
 * Marks and numbers = modelo, Code = VIN, Description (al lado del VIN) = color.
 * Cabecera: consignatario, RIF, destino, nº factura y CIF unitario.
 */

import { inferCheryModelo } from "./chery-modelo";
import { salvageCheryVin } from "./vin-text";

export type CheryInvoiceLinea = {
  vin: string;
  modelo: string | null;
  color: string | null;
  serialMotor: string | null;
  valorCif: number | null;
};

export type CheryInvoiceHeader = {
  consignatario: string | null;
  rif: string | null;
  destino: string | null;
  numeroFactura: string | null;
  cifUnitario: number | null;
  cifTotal: number | null;
  paisOrigen: string | null;
  marca: string | null;
  exportador: string | null;
};

export type CheryCommercialInvoice = {
  header: CheryInvoiceHeader;
  lineas: CheryInvoiceLinea[];
};

const MODEL_RE = /((?:TIGGO|ARRIZO|OMODA)\s+\d+(?:\s+PRO)?(?:\s+MAX)?)/gi;

const VIN_TOKEN_RE = /(L[VWY][A-HJ-NPR-Z0-9]{13,16})/gi;

const COLOR_RE =
  /([A-Z]{3,12}\s+(?:SILVER|GRAY|GREY|WHITE|BLACK|BLUE|RED|GREEN|GOLD|BEIGE|BROWN|PEARL|METALLIC))/i;

const ENGINE_NEAR_RE =
  /ENGINE\s*(?:SERIAL\s*)?(?:NO|N[°º.]|NUMBER|#)?\.?\s*[:#]?\s*([A-Z0-9\-]{6,20})/i;

const LINE_RE = new RegExp(
  `${MODEL_RE.source}\\s+${VIN_TOKEN_RE.source}\\s+${COLOR_RE.source}`,
  "gi"
);

const DESTINO_KNOWN_RE =
  /\b(El Guamache|Guamache|La Guaira|Puerto Cabello|Guanta|Guamache Port)\b/i;

function titleColor(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(S\.?A\.?|C\.?A\.?)\b/gi, (m) => m.replace(/\s+/g, "").toUpperCase())
    .replace(/\b[A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ']*/g, (w) => {
      if (/^(S\.?A\.?|C\.?A\.?|RIF|SA|CA)$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
}

function flattenInvoiceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 11.014 (miles europeos) → 11014. No interpreta 11.50 como miles.
 */
export function parseEuropeanMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s/g, "");
  if (/^\d{1,3}\.\d{3}$/.test(s)) return Number(s.replace(".", ""));
  if (/^\d{1,3}\.\d{3}\.\d{3}$/.test(s)) return Number(s.replace(/\./g, ""));
  if (/^\d{1,3},\d{3}(?:\.\d{1,2})?$/.test(s)) {
    return Number(s.replace(/,/g, ""));
  }
  if (/^\d{4,7}(?:\.\d{1,2})?$/.test(s)) return Number(s);
  return null;
}

function pickLabelValue(flat: string, labels: RegExp, stop: RegExp): string | null {
  const m = flat.match(labels);
  if (!m || m.index == null) return null;
  const after = flat.slice(m.index + m[0].length).trim();
  const cut = after.search(stop);
  const chunk = (cut >= 0 ? after.slice(0, cut) : after.slice(0, 80)).trim();
  return chunk || null;
}

export function parseCheryInvoiceHeader(text: string): CheryInvoiceHeader {
  const empty: CheryInvoiceHeader = {
    consignatario: null,
    rif: null,
    destino: null,
    numeroFactura: null,
    cifUnitario: null,
    cifTotal: null,
    paisOrigen: null,
    marca: null,
    exportador: null,
  };
  if (!text?.trim()) return empty;

  const flat = flattenInvoiceText(text);
  const upper = flat.toUpperCase();

  let consignatario: string | null = null;
  const consRaw = pickLabelValue(
    flat,
    /CONSIGNEE\s*[:.]?/i,
    /\b(?:RIF|J-\d|ADDRESS|NOTIFY|DESTINATION|TEL|PHONE|CARACAS)\b/i
  );
  if (consRaw && /MOTORS|S\.?\s*A|C\.?\s*A|IMPORT|AUTO/i.test(consRaw)) {
    consignatario = titleName(consRaw.replace(/[,;]+$/, ""));
  }
  if (!consignatario) {
    const iksan = flat.match(/\b(IKSAN\s+MOTORS(?:\s*,?\s*S\.?\s*A\.?)?)\b/i);
    if (iksan) consignatario = titleName(iksan[1]);
  }

  let rif: string | null = null;
  const rifM = flat.match(/\bRIF[:\s]*([JVEGPC])[-\s]?(\d{6,12})(?:[-\s]?(\d))?\b/i);
  if (rifM) {
    const letter = rifM[1].toUpperCase();
    const digits = `${rifM[2]}${rifM[3] ?? ""}`;
    rif = `${letter}-${digits}`;
  }

  let destino: string | null = null;
  const destKnown = flat.match(DESTINO_KNOWN_RE);
  if (destKnown) {
    destino = titleName(destKnown[1].replace(/\s+Port$/i, ""));
  } else {
    const destRaw = pickLabelValue(
      flat,
      /DESTINATION\s*[:.]?/i,
      /\b(?:COUNTRY|PORT OF|VESSEL|NOTIFY|SHIPPING|MARKS)\b/i
    );
    if (destRaw && destRaw.length >= 4 && destRaw.length <= 40) {
      destino = titleName(destRaw);
    }
  }

  let numeroFactura: string | null = null;
  const inv = flat.match(
    /INVOICE\s*(?:NO|N[Oº°]|NUMBER|#)?[:.\s]*([A-Z0-9][A-Z0-9-]{7,32})/i
  );
  if (inv) {
    const cand = inv[1].replace(/[.,;]+$/, "");
    if (!/^(NO|NUMBER|DATE)$/i.test(cand)) numeroFactura = cand.toUpperCase();
  }

  let paisOrigen: string | null = null;
  const origin = flat.match(
    /COUNTRY\s+OF\s+ORIGIN(?:\s+OF\s+GOODS)?\s*[:.]?\s*([A-Z]{3,20})/i
  );
  if (origin) {
    paisOrigen = titleName(origin[1]);
  } else if (/\bCHINA\b/i.test(flat) && /ORIGIN/i.test(flat)) {
    paisOrigen = "China";
  }

  const marca = /\bCHERY\b/i.test(flat) ? "Chery" : null;
  const expM = flat.match(/\bINTERCONTINENTAL(?:\s+[A-Z][A-Z ]{2,24})?/i);
  const exportador = expM ? titleName(expM[0].slice(0, 48)) : null;

  const moneyHits = [...upper.matchAll(/\b(\d{1,3}\.\d{3}|\d{4,6})\b/g)]
    .map((m) => parseEuropeanMoney(m[1]))
    .filter((n): n is number => n != null && n >= 1000 && n <= 500_000);

  let cifUnitario: number | null = null;
  let cifTotal: number | null = null;
  const cifNear = upper.match(/\bCIF\b[^0-9]{0,28}(\d{1,3}\.\d{3}|\d{4,6})/);
  if (cifNear) cifUnitario = parseEuropeanMoney(cifNear[1]);

  const totalNear = upper.match(
    /\b(?:TOTAL|AMOUNT|CIF\s+TOTAL)\b[^0-9]{0,28}(\d{1,3}\.\d{3}|\d{4,6})/
  );
  if (totalNear) cifTotal = parseEuropeanMoney(totalNear[1]);

  if (cifUnitario != null && cifTotal != null && cifTotal < cifUnitario) {
    const swap = cifUnitario;
    cifUnitario = cifTotal;
    cifTotal = swap;
  }

  if (cifUnitario == null && moneyHits.length > 0) {
    const counts = new Map<number, number>();
    for (const n of moneyHits) counts.set(n, (counts.get(n) ?? 0) + 1);
    const repeated = [...counts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (repeated[0]) cifUnitario = repeated[0][0];
  }

  return {
    consignatario,
    rif,
    destino,
    numeroFactura,
    cifUnitario,
    cifTotal,
    paisOrigen,
    marca,
    exportador,
  };
}

/**
 * Extrae filas `TIGGO 2 PRO MAX <VIN> NASDAQ SILVER` aunque el PDF
 * aplaste saltos de línea en un solo bloque.
 */
export function parseCheryInvoiceLineas(text: string): CheryInvoiceLinea[] {
  if (!text?.trim()) return [];
  const upper = text.toUpperCase().replace(/\s+/g, " ");
  const header = parseCheryInvoiceHeader(text);
  const byVin = new Map<string, CheryInvoiceLinea>();

  const add = (
    rawVin: string,
    modeloRaw?: string | null,
    colorRaw?: string | null,
    motorRaw?: string | null
  ) => {
    const vin = salvageCheryVin(rawVin);
    if (!vin || byVin.has(vin)) return;
    const modelo = inferCheryModelo(modeloRaw) || modeloRaw?.trim() || null;
    const color = colorRaw ? titleColor(colorRaw) : null;
    const serialMotor = motorRaw?.replace(/[^A-Z0-9\-]/gi, "").toUpperCase() || null;
    byVin.set(vin, {
      vin,
      modelo,
      color,
      serialMotor:
        serialMotor && serialMotor.length >= 6 && serialMotor.length <= 20
          ? serialMotor
          : null,
      valorCif: header.cifUnitario,
    });
  };

  for (const m of upper.matchAll(LINE_RE)) {
    const vinRaw = m[2] ?? "";
    const idx = m.index ?? 0;
    const after = upper.slice(idx + m[0].length, idx + m[0].length + 48);
    add(vinRaw, m[1], m[3], after.match(ENGINE_NEAR_RE)?.[1]);
  }

  if (byVin.size === 0) {
    const tokens = [...upper.matchAll(VIN_TOKEN_RE)];
    for (const tok of tokens) {
      const raw = tok[1] ?? "";
      const idx = tok.index ?? 0;
      const before = upper.slice(Math.max(0, idx - 40), idx);
      const after = upper.slice(idx + raw.length, idx + raw.length + 48);
      const modelM = before.match(
        /((?:TIGGO|ARRIZO|OMODA)\s+\d+(?:\s+PRO)?(?:\s+MAX)?)\s*$/i
      );
      const colorM = after.match(COLOR_RE);
      add(raw, modelM?.[1], colorM?.[1], after.match(ENGINE_NEAR_RE)?.[1]);
    }
  }

  return [...byVin.values()];
}

export function parseCheryCommercialInvoice(text: string): CheryCommercialInvoice {
  return {
    header: parseCheryInvoiceHeader(text),
    lineas: parseCheryInvoiceLineas(text),
  };
}

export function cheryHeaderHasShipmentData(header: CheryInvoiceHeader): boolean {
  return Boolean(
    header.consignatario ||
      header.rif ||
      header.destino ||
      header.numeroFactura ||
      header.cifUnitario != null
  );
}
