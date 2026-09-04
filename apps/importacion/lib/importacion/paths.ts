/** Ruta pública de SmartImport (Puerto Libre). */
export const IMPORTACION_BASE = "/smartimport" as const;
/** Guion de demo a cliente + cuestionario de afinado. */
export const SMARTIMPORT_DEMO_PATH = `${IMPORTACION_BASE}/demo` as const;
/** Carga precargada (requiere sesión): 3 expedientes + PDF de la nube. */
export const SMARTIMPORT_DEMO_EXPEDIENTE_PATH =
  `${IMPORTACION_BASE}/expediente-demo` as const;
/** QA: un expediente por fase de planilla (requiere sesión). */
export const SMARTIMPORT_DEMO_FASES_PATH =
  `${IMPORTACION_BASE}/demo-fases` as const;
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

/** 1.ª cola del dashboard: Por completar registro. */
export const DASHBOARD_COLA_REGISTRO_ID = "cola-registro";
/** 2.ª cola del dashboard: Por completar embarque. */
export const DASHBOARD_COLA_EMBARQUE_ID = "cola-embarque";
/** 3.ª cola del dashboard: Por completar llegada. */
export const DASHBOARD_COLA_LLEGADA_ID = "cola-llegada";
/** 4.ª cola del dashboard: Por completar desaduanamiento. */
export const DASHBOARD_COLA_DESADUANAMIENTO_ID = "cola-desaduanamiento";
/** Cola: Por completar pago impuesto. */
export const DASHBOARD_COLA_PAGO_IMPUESTO_ID = "cola-pago-impuesto";
/** Cola: Por completar inspección. */
export const DASHBOARD_COLA_INSPECCION_ID = "cola-inspeccion";
/** Cola: Por completar propietario. */
export const DASHBOARD_COLA_PROPIETARIO_ID = "cola-propietario";
/** Cola: Por completar seguro. */
export const DASHBOARD_COLA_SEGURO_ID = "cola-seguro";
/** Cola: Por completar matrícula. */
export const DASHBOARD_COLA_MATRICULA_ID = "cola-matricula";
/** Cola: Por completar placa (foto + título). */
export const DASHBOARD_COLA_PLACA_ID = "cola-placa";

export const DASHBOARD_COLA_IDS = {
  1: DASHBOARD_COLA_REGISTRO_ID,
  2: DASHBOARD_COLA_EMBARQUE_ID,
  3: DASHBOARD_COLA_LLEGADA_ID,
  4: DASHBOARD_COLA_DESADUANAMIENTO_ID,
  5: DASHBOARD_COLA_PAGO_IMPUESTO_ID,
  6: DASHBOARD_COLA_INSPECCION_ID,
  7: DASHBOARD_COLA_PROPIETARIO_ID,
  8: DASHBOARD_COLA_SEGURO_ID,
  9: DASHBOARD_COLA_MATRICULA_ID,
  10: DASHBOARD_COLA_PLACA_ID,
} as const;

/** Dashboard anclado en Por completar llegada. */
export function hrefDashboardColaLlegada(): string {
  return `${IMPORTACION_BASE}#${DASHBOARD_COLA_LLEGADA_ID}`;
}

export function hrefDashboardCola(
  fase: keyof typeof DASHBOARD_COLA_IDS
): string {
  return `${IMPORTACION_BASE}#${DASHBOARD_COLA_IDS[fase]}`;
}

/**
 * Tras guardar embarque: «Continuar a Llegada» abre la fase 3;
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
  return id
    ? `${IMPORTACION_BASE}/${id}/planilla?fase=3`
    : hrefDashboardColaLlegada();
}
