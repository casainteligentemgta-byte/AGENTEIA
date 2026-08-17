/** Ruta pública de SmartImport (Puerto Libre). */
export const IMPORTACION_BASE = "/smartimport" as const;
/** Ruta anterior; se redirige a IMPORTACION_BASE. */
export const IMPORTACION_LEGACY_BASE = "/importacion" as const;

export function importacionPath(
  suffix: string = ""
): `${typeof IMPORTACION_BASE}${string}` {
  if (!suffix) return IMPORTACION_BASE;
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${IMPORTACION_BASE}${normalized}`;
}

/** Convierte `/importacion/...` en `/smartimport/...`. */
export function canonicalizeImportacionPath(path: string): string {
  if (
    path === IMPORTACION_LEGACY_BASE ||
    path.startsWith(`${IMPORTACION_LEGACY_BASE}/`)
  ) {
    return `${IMPORTACION_BASE}${path.slice(IMPORTACION_LEGACY_BASE.length)}`;
  }
  return path;
}

export function isImportacionAppPath(path: string): boolean {
  const normalized = canonicalizeImportacionPath(path);
  return (
    normalized === IMPORTACION_BASE ||
    normalized.startsWith(`${IMPORTACION_BASE}/`)
  );
}
