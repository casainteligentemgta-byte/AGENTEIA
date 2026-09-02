/** Ruta pública de SmartImport (Puerto Libre). */
export const IMPORTACION_BASE = "/smartimport" as const;
/** Guion de demo a cliente + cuestionario de afinado. */
export const SMARTIMPORT_DEMO_PATH = `${IMPORTACION_BASE}/demo` as const;
/** Expediente precargado (requiere sesión) para adjuntar PDF de la nube. */
export const SMARTIMPORT_DEMO_EXPEDIENTE_PATH =
  `${IMPORTACION_BASE}/expediente-demo` as const;
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

/** 2.ª cola del dashboard: Por completar embarque. */
export const DASHBOARD_COLA_EMBARQUE_ID = "cola-embarque";
/** Cola: Por completar propietario. */
export const DASHBOARD_COLA_PROPIETARIO_ID = "cola-propietario";
/** Cola: Por completar seguro. */
export const DASHBOARD_COLA_SEGURO_ID = "cola-seguro";
/** Cola: Por completar matrícula. */
export const DASHBOARD_COLA_MATRICULA_ID = "cola-matricula";

/**
 * Tras guardar embarque: «Continuar a Llegada» va al dashboard (2.ª cola);
 * «Guardar e ir a la ficha» abre el expediente.
 */
export function hrefAfterFase2Embarque(
  after: "next" | "ficha",
  vehiculoId: string
): string {
  const id = vehiculoId.trim();
  if (after === "ficha") {
    return id ? `${IMPORTACION_BASE}/${id}` : IMPORTACION_BASE;
  }
  return `${IMPORTACION_BASE}#${DASHBOARD_COLA_EMBARQUE_ID}`;
}
