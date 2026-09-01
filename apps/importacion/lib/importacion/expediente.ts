/**
 * Nomenclatura de expedientes Puerto Libre:
 * PL-{año}.{mes}.{número}  →  ej. PL-2026.7.1
 * (año calendario, mes sin cero a la izquierda, número secuencial del mes)
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

/**
 * Orden cronológico ascendente de expedientes PL. Los registros sin código
 * quedan al final y conservan su orden de creación ascendente.
 */
export function compareExpedientesAsc(
  a: { codigoExpediente: string | null; created_at: string },
  b: { codigoExpediente: string | null; created_at: string }
): number {
  const codigoA = parseCodigoExpediente(a.codigoExpediente);
  const codigoB = parseCodigoExpediente(b.codigoExpediente);

  if (codigoA && codigoB) {
    return (
      codigoA.year - codigoB.year ||
      codigoA.month - codigoB.month ||
      codigoA.numero - codigoB.numero
    );
  }
  if (codigoA) return -1;
  if (codigoB) return 1;
  return a.created_at.localeCompare(b.created_at);
}

const CODIGO_IN_TEXT_RE = /PL-\d{4}\.\d{1,2}\.\d+/i;

/** Extrae PL-Y.M.N aunque la celda traiga un semáforo u otro prefijo. */
export function codigoExpedienteFromLabel(
  raw: string | null | undefined
): CodigoExpedienteParts | null {
  if (!raw) return null;
  const found = CODIGO_IN_TEXT_RE.exec(raw);
  return parseCodigoExpediente(found?.[0] ?? raw);
}

/** Orden de menor a mayor por número de expediente en etiquetas de lista. */
export function compareExpedienteLabelsAsc(a: string, b: string): number {
  const pa = codigoExpedienteFromLabel(a);
  const pb = codigoExpedienteFromLabel(b);
  if (pa && pb) {
    return pa.year - pb.year || pa.month - pb.month || pa.numero - pb.numero;
  }
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Placeholder único en BD cuando aún no hay placa real (placa ≠ expediente). */
export function placaPendienteDesdeCodigo(codigoExpediente: string): string {
  const parts = parseCodigoExpediente(codigoExpediente);
  if (parts) return `NP-${parts.year}.${parts.month}.${parts.numero}`;
  return `NP-${codigoExpediente.replace(/^PL-/i, "").trim() || Date.now()}`;
}

/**
 * Placa real del vehículo (no el expediente ni el placeholder NP-*).
 * La placa y el número de expediente son independientes.
 */
export function placaRealVisible(
  placa: string | null | undefined,
  codigoExpediente?: string | null
): string | null {
  const raw = placa?.trim() ?? "";
  if (!raw) return null;
  if (/^NP-/i.test(raw)) return null;
  const codigo = resolveCodigoExpediente({
    codigoExpediente: codigoExpediente ?? null,
    placa: null,
  });
  if (codigo && raw.toUpperCase() === codigo.toUpperCase()) return null;
  // Legado: se usaba el código PL-Y.M.N como placa.
  if (parseCodigoExpediente(raw)) return null;
  return raw.toUpperCase();
}
