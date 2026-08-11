/** Cédula venezolana: V|E + 6–9 dígitos (con o sin guion). */
export const CEDULA_PLACEHOLDER = "V-12345678";

export const CEDULA_FORMAT_HINT = "Formato: V-######## o E-########";

/**
 * Normaliza cédula. Si viene un RIF de persona natural (V/E-########-#),
 * se descarta el dígito verificador (caso frecuente tras OCR del carnet RIF).
 */
export function normalizeCedula(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
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

/** Deriva cédula desde un RIF V/E (cuerpo sin dígito verificador). */
export function cedulaFromRifNatural(rif: string): string | null {
  const cleaned = rif.trim().toUpperCase().replace(/\s+/g, "");
  const m = cleaned.match(/^([VE])-(\d{8})-\d$/);
  if (!m) return null;
  const normalized = normalizeCedula(`${m[1]}-${m[2]}`);
  return isValidCedula(normalized) ? normalized : null;
}
