/**
 * Nomenclatura de expedientes Puerto Libre:
 * PL-{año}.{mes}.{número}  →  ej. PL-2026.6.3
 */

const CODIGO_RE = /^PL-(\d{4})\.(\d{1,2})\.(\d+)$/i;

export type CodigoExpedienteParts = {
  year: number;
  month: number;
  numero: number;
};

export function formatCodigoExpediente(
  year: number,
  month: number,
  numero: number
): string {
  return `PL-${year}.${month}.${numero}`;
}

export function parseCodigoExpediente(raw: string | null | undefined): CodigoExpedienteParts | null {
  if (!raw) return null;
  const m = CODIGO_RE.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const numero = Number(m[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || numero < 1) return null;
  return { year, month, numero };
}

export function partsFromDate(date: Date = new Date()): Pick<CodigoExpedienteParts, "year" | "month"> {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Prefijo de mes para buscar códigos existentes: PL-2026.6. */
export function expedienteMonthPrefix(year: number, month: number): string {
  return `PL-${year}.${month}.`;
}

/**
 * Resuelve el código a mostrar: importacion.codigoExpediente, placa si ya es PL-Y.M.N,
 * o null si aún no hay.
 */
export function resolveCodigoExpediente(params: {
  codigoExpediente?: string | null;
  placa?: string | null;
}): string | null {
  const fromImport = parseCodigoExpediente(params.codigoExpediente ?? null);
  if (fromImport) {
    return formatCodigoExpediente(fromImport.year, fromImport.month, fromImport.numero);
  }
  const fromPlaca = parseCodigoExpediente(params.placa ?? null);
  if (fromPlaca) {
    return formatCodigoExpediente(fromPlaca.year, fromPlaca.month, fromPlaca.numero);
  }
  return null;
}
