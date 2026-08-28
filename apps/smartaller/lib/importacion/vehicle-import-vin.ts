import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import {
  normalizeSerialKey,
  pairSerialsOneToOne,
} from "@/lib/importacion/carga-masiva-ui";
import { compactAlnumVin, normalizeVinLoose } from "@/lib/importacion/vin-text";

export type VinDocSources = {
  factura: string | null;
  certificado: string | null;
};

export type VinCheckStatus = "ok" | "warn" | "fail";

export type VinCheckItem = {
  status: VinCheckStatus;
  label: string;
};

export type VinCrossCheckResult = {
  display: string;
  formatOk: boolean;
  items: VinCheckItem[];
};

export function rowVinValue(row: Pick<CargaMasivaRow, "vin" | "serialCarroceria">): string {
  return (row.vin || row.serialCarroceria).trim();
}

export function vinsCoincide(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeSerialKey(a ?? "");
  const right = normalizeSerialKey(b ?? "");
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 11 || right.length < 11) return false;
  return left.startsWith(right) || right.startsWith(left);
}

function docCheck(
  current: string,
  source: string | null,
  doc: "factura" | "certificado"
): VinCheckItem {
  if (!source) {
    if (doc === "certificado") {
      return { status: "warn", label: "No coincide con certificado (REVISAR)" };
    }
    return { status: "warn", label: "Sin VIN en factura" };
  }
  if (vinsCoincide(current, source)) {
    return { status: "ok", label: `Coincide con ${doc}` };
  }
  return {
    status: "warn",
    label:
      doc === "certificado"
        ? "No coincide con certificado (REVISAR)"
        : "No coincide con factura (REVISAR)",
  };
}

export function evaluateVinCrossCheck(
  currentVin: string,
  sources?: VinDocSources
): VinCrossCheckResult {
  const display = compactAlnumVin(currentVin);
  const formatOk = Boolean(normalizeVinLoose(display, { strict: true }));
  const format: VinCheckItem = formatOk
    ? { status: "ok", label: "Formato válido (17 caracteres)" }
    : display.length === 0
      ? { status: "fail", label: "Falta el VIN (17 caracteres)" }
      : {
          status: "fail",
          label: `Formato inválido (${display.length} caracteres)`,
        };

  return {
    display,
    formatOk,
    items: [
      format,
      docCheck(display, sources?.factura ?? null, "factura"),
      docCheck(display, sources?.certificado ?? null, "certificado"),
    ],
  };
}

export function snapshotFacturaVins(
  rows: CargaMasivaRow[]
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const row of rows) {
    const vin = rowVinValue(row);
    if (vin) next[row.id] = vin;
  }
  return next;
}

export function buildVinSources(params: {
  rows: CargaMasivaRow[];
  facturaByRowId: Record<string, string>;
  certSerials: string[];
}): Record<string, VinDocSources> {
  const rowSerials = params.rows.map(
    (row) => params.facturaByRowId[row.id] || rowVinValue(row)
  );
  const paired = pairSerialsOneToOne(rowSerials, params.certSerials);
  const sources: Record<string, VinDocSources> = {};
  for (const row of params.rows) {
    const factura = (params.facturaByRowId[row.id] ?? "").trim() || null;
    const needle = normalizeSerialKey(factura || rowVinValue(row));
    sources[row.id] = {
      factura,
      certificado: needle ? paired.get(needle) ?? null : null,
    };
  }
  return sources;
}

export function parseVinSources(raw: unknown): Record<string, VinDocSources> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, VinDocSources> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    out[id] = {
      factura:
        typeof o.factura === "string" && o.factura.trim() ? o.factura : null,
      certificado:
        typeof o.certificado === "string" && o.certificado.trim()
          ? o.certificado
          : null,
    };
  }
  return out;
}
