/**
 * Parser determinista de factura Chery / Intercontinental:
 * Marks and numbers = modelo, Code = VIN, Description (al lado del VIN) = color.
 */

import { inferCheryModelo } from "./chery-modelo";
import { salvageCheryVin } from "./vin-text";

export type CheryInvoiceLinea = {
  vin: string;
  modelo: string | null;
  color: string | null;
};

const MODEL_RE = /((?:TIGGO|ARRIZO|OMODA)\s+\d+(?:\s+PRO)?(?:\s+MAX)?)/gi;

const VIN_TOKEN_RE = /(L[VWY][A-HJ-NPR-Z0-9]{13,16})/gi;

const COLOR_RE =
  /([A-Z]{3,12}\s+(?:SILVER|GRAY|GREY|WHITE|BLACK|BLUE|RED|GREEN|GOLD|BEIGE|BROWN|PEARL|METALLIC))/i;

const LINE_RE = new RegExp(
  `${MODEL_RE.source}\\s+${VIN_TOKEN_RE.source}\\s+${COLOR_RE.source}`,
  "gi"
);

function titleColor(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extrae filas `TIGGO 2 PRO MAX <VIN> NASDAQ SILVER` aunque el PDF
 * aplaste saltos de línea en un solo bloque.
 */
export function parseCheryInvoiceLineas(text: string): CheryInvoiceLinea[] {
  if (!text?.trim()) return [];
  const upper = text.toUpperCase().replace(/\s+/g, " ");
  const byVin = new Map<string, CheryInvoiceLinea>();

  const add = (rawVin: string, modeloRaw?: string | null, colorRaw?: string | null) => {
    const vin = salvageCheryVin(rawVin);
    if (!vin || byVin.has(vin)) return;
    const modelo = inferCheryModelo(modeloRaw) || modeloRaw?.trim() || null;
    const color = colorRaw ? titleColor(colorRaw) : null;
    byVin.set(vin, { vin, modelo, color });
  };

  for (const m of upper.matchAll(LINE_RE)) {
    add(m[2] ?? "", m[1], m[3]);
  }

  if (byVin.size === 0) {
    const tokens = [...upper.matchAll(VIN_TOKEN_RE)];
    for (const tok of tokens) {
      const raw = tok[1] ?? "";
      const idx = tok.index ?? 0;
      const before = upper.slice(Math.max(0, idx - 40), idx);
      const after = upper.slice(idx + raw.length, idx + raw.length + 32);
      const modelM = before.match(
        /((?:TIGGO|ARRIZO|OMODA)\s+\d+(?:\s+PRO)?(?:\s+MAX)?)\s*$/i
      );
      const colorM = after.match(COLOR_RE);
      add(raw, modelM?.[1], colorM?.[1]);
    }
  }

  return [...byVin.values()];
}
