/**
 * Puertos de descarga habituales en importación vehicular (Bolivariana de Puertos / SENIAT).
 * Distintos de la aduana de despacho, aunque a menudo coinciden en nombre.
 */
export const PUERTOS_DESCARGA_VENEZUELA = [
  "Carúpano",
  "Ciudad Guayana",
  "El Guamache",
  "Guanta",
  "Güiria",
  "La Guaira",
  "Las Piedras",
  "Maracaibo",
  "Puerto Ayacucho",
  "Puerto Cabello",
  "Puerto Sucre",
] as const;

export type PuertoDescargaVenezuela = (typeof PUERTOS_DESCARGA_VENEZUELA)[number];

const PUERTO_ALIASES: Record<string, PuertoDescargaVenezuela> = {
  guanta: "Guanta",
  "puerto la cruz": "Guanta",
  "guanta puerto la cruz": "Guanta",
  "guanta-puerto la cruz": "Guanta",
  guamache: "El Guamache",
  "el guamache": "El Guamache",
  margarita: "El Guamache",
  "la guaira": "La Guaira",
  guaira: "La Guaira",
  "puerto cabello": "Puerto Cabello",
  cabello: "Puerto Cabello",
  maracaibo: "Maracaibo",
  carupano: "Carúpano",
  carúpano: "Carúpano",
  guiria: "Güiria",
  güiria: "Güiria",
  "ciudad guayana": "Ciudad Guayana",
  "puerto ordaz": "Ciudad Guayana",
  "puerto ayacucho": "Puerto Ayacucho",
  "puerto sucre": "Puerto Sucre",
  cumana: "Puerto Sucre",
  cumaná: "Puerto Sucre",
  "las piedras": "Las Piedras",
  paraguaná: "Las Piedras",
  paraguana: "Las Piedras",
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Resuelve un nombre libre (OCR) al catálogo cuando es posible. */
export function resolvePuertoDescarga(
  value: string | null | undefined
): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  const exact = PUERTOS_DESCARGA_VENEZUELA.find(
    (p) => p.toLowerCase() === raw.toLowerCase()
  );
  if (exact) return exact;
  const alias = PUERTO_ALIASES[normalizeKey(raw)];
  if (alias) return alias;
  const partial = PUERTOS_DESCARGA_VENEZUELA.find((p) => {
    const key = normalizeKey(p);
    const n = normalizeKey(raw);
    return key.includes(n) || n.includes(key);
  });
  return partial ?? raw;
}

/** Parte un valor guardado (uno o varios puertos separados) en lista canónica. */
export function parsePuertosDescarga(
  value: string | null | undefined
): string[] {
  const raw = value?.trim() ?? "";
  if (!raw) return [];
  const parts = raw
    .split(/[,;|/·]+|\s+y\s+/i)
    .map((p) => resolvePuertoDescarga(p))
    .filter(Boolean);
  return [...new Set(parts)];
}

/** Serializa la selección múltiple para persistir en `importacion.puerto`. */
export function formatPuertosDescarga(puertos: string[]): string {
  const cleaned = [
    ...new Set(
      puertos.map((p) => resolvePuertoDescarga(p)).filter(Boolean)
    ),
  ];
  return cleaned.join(", ");
}

/** Valor único para un `<select>` de puerto (toma el primero del catálogo si venía multi). */
export function primaryPuertoDescarga(
  value: string | null | undefined
): string {
  const selected = parsePuertosDescarga(value);
  const catalogado = selected.find((p) =>
    PUERTOS_DESCARGA_VENEZUELA.includes(p as PuertoDescargaVenezuela)
  );
  if (catalogado) return catalogado;
  const resolved = resolvePuertoDescarga(value);
  if (
    PUERTOS_DESCARGA_VENEZUELA.includes(resolved as PuertoDescargaVenezuela)
  ) {
    return resolved;
  }
  return selected[0] ?? "";
}

export function isPuertoDescargaCatalogado(value: string): boolean {
  const resolved = resolvePuertoDescarga(value);
  return PUERTOS_DESCARGA_VENEZUELA.some((p) => p === resolved);
}
