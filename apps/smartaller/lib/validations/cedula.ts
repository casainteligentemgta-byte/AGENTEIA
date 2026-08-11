/** Cédula venezolana: V|E + 6–9 dígitos (con o sin guion). */
export const CEDULA_PLACEHOLDER = "V-12345678";

export const CEDULA_FORMAT_HINT = "Formato: V-######## o E-########";

export function normalizeCedula(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return "";
  const m = cleaned.match(/^([VE])-?(\d{6,9})$/);
  if (m) return `${m[1]}-${m[2]}`;
  if (/^\d{6,9}$/.test(cleaned)) return `V-${cleaned}`;
  return cleaned;
}

export function isValidCedula(raw: string): boolean {
  return /^[VE]-\d{6,9}$/.test(normalizeCedula(raw));
}
