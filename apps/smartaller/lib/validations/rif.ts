/** RIF venezolano: J|V|E|G|P|C-########-# */
export const RIF_PATTERN = /^[JVEGPC]-\d{8}-\d$/i;

export const RIF_PLACEHOLDER = "J-12345678-9";

export const RIF_FORMAT_HINT = "Formato: J-########-# o V-########-#";

/** Normaliza espacios y fuerza mayúsculas en la letra. */
export function normalizeRif(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidRif(raw: string): boolean {
  const value = normalizeRif(raw);
  if (!value) return false;
  return RIF_PATTERN.test(value);
}
