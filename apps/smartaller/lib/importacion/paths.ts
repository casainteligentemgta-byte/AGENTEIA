/** Ruta pública del módulo Puerto Libre NFC (aislado). */
export const IMPORTACION_BASE = "/importacion" as const;

export function importacionPath(
  suffix: string = ""
): `${typeof IMPORTACION_BASE}${string}` {
  if (!suffix) return IMPORTACION_BASE;
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${IMPORTACION_BASE}${normalized}`;
}
