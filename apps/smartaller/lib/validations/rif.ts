/** RIF venezolano canónico: J|V|E|G|P|C-########-# */
export const RIF_PATTERN = /^[JVEGPC]-\d{8}-\d$/;

export const RIF_PLACEHOLDER = "J-12345678-9";

export const RIF_FORMAT_HINT = "Formato: J-########-# o V-########-#";

/**
 * Normaliza un RIF al formato canónico LETRA-########-#.
 * Acepta cómo se escribe en carnet/comprobante: con o sin guiones, con puntos
 * de miles, espacios o guiones tipográficos.
 *
 * Ejemplos → V-12345678-9 / J-12345678-9:
 * - V-12345678-9
 * - V123456789
 * - V-12.345.678-9
 * - J 12345678 9
 */
export function normalizeRif(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[.\s]/g, "")
    .replace(/[–—−‐]/g, "-");

  if (!cleaned) return "";
  if (RIF_PATTERN.test(cleaned)) return cleaned;

  // Letra + 8 dígitos + verificador, guiones opcionales: J123456789, J-12345678-9
  const compact = cleaned.match(/^([JVEGPC])-?(\d{8})-?(\d)$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  // Cuerpo de 6–7 dígitos con guiones (cédulas cortas): V-1234567-9 → V-01234567-9
  const padded = cleaned.match(/^([JVEGPC])-(\d{6,7})-(\d)$/);
  if (padded) {
    return `${padded[1]}-${padded[2].padStart(8, "0")}-${padded[3]}`;
  }

  return cleaned;
}

export function isValidRif(raw: string): boolean {
  const value = normalizeRif(raw);
  if (!value) return false;
  return RIF_PATTERN.test(value);
}
