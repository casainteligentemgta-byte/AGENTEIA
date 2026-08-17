/** Cédula venezolana: V|E + 6–9 dígitos (con o sin guion / puntos). */
export const CEDULA_PLACEHOLDER = "V-12.345.678";

export const CEDULA_FORMAT_HINT = "Formato: V-XX.XXX.XXX";

export const RIF_CEDULA_COINCIDEN_HINT =
  "Deben coincidir letra y números (el RIF solo agrega el dígito final)";

/**
 * Normaliza cédula. Acepta puntos (V-13.848.186). Si viene un RIF natural
 * (V/E-########-#), descarta el dígito verificador.
 */
export function normalizeCedula(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
  if (!cleaned) return "";

  // RIF natural con dígito verificador: V-13848186-3 → V-13848186
  const rifNatural = cleaned.match(/^([VE])-?(\d{6,9})-(\d)$/);
  if (rifNatural) {
    const body = stripLeadingZeros(rifNatural[2]);
    if (body.length >= 6 && body.length <= 9) {
      return `${rifNatural[1]}-${body}`;
    }
    return `${rifNatural[1]}-${rifNatural[2]}`;
  }

  const m = cleaned.match(/^([VE])-?(\d{6,9})$/);
  if (m) {
    const body = stripLeadingZeros(m[2]);
    if (body.length >= 6 && body.length <= 9) {
      return `${m[1]}-${body}`;
    }
    return `${m[1]}-${m[2]}`;
  }

  if (/^\d{6,9}$/.test(cleaned)) return `V-${stripLeadingZeros(cleaned)}`;
  return cleaned;
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : digits;
}

export function isValidCedula(raw: string): boolean {
  return /^[VE]-\d{6,9}$/.test(normalizeCedula(raw));
}

/** Presentación: V-12.345.678 (miles con punto, desde la derecha). */
export function formatCedulaDisplay(raw: string): string {
  const normalized = normalizeCedula(raw);
  const m = normalized.match(/^([VE])-(\d{6,9})$/);
  if (!m) return raw.trim().toUpperCase();
  const grouped = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${m[1]}-${grouped}`;
}

/** Deriva cédula desde un RIF V/E (cuerpo sin dígito verificador).
 * Ejemplo: V-13848186-3 → V-13848186.
 */
export function cedulaFromRifNatural(rif: string): string | null {
  const cleaned = rif.trim().toUpperCase().replace(/\s+/g, "");
  const m = cleaned.match(/^([VE])-(\d{8})-\d$/);
  if (!m) return null;
  const normalized = normalizeCedula(`${m[1]}-${m[2]}`);
  return isValidCedula(normalized) ? normalized : null;
}

/**
 * Persona natural: el RIF es la cédula + dígito verificador.
 * Compara letra y números (sin ceros a la izquierda).
 */
export function rifNaturalCoincideConCedula(
  rif: string,
  cedula: string
): boolean {
  const rifNorm = rif.trim().toUpperCase().replace(/\s+/g, "");
  const rifMatch = rifNorm.match(/^([VE])-(\d{8})-(\d)$/);
  if (!rifMatch) return false;

  const cedNorm = normalizeCedula(cedula);
  const cedMatch = cedNorm.match(/^([VE])-(\d{6,9})$/);
  if (!cedMatch) return false;

  if (rifMatch[1] !== cedMatch[1]) return false;

  const rifDigits = stripLeadingZeros(rifMatch[2]);
  const cedDigits = stripLeadingZeros(cedMatch[2]);
  return rifDigits === cedDigits;
}
