/**
 * Aduanas principales de Venezuela (SENIAT / Reglamento de la Ley Orgánica de Aduanas).
 * Incluye Güiria y Aérea de Valencia, habituales en la práctica operativa.
 */
export const ADUANAS_VENEZUELA = [
  "Aérea de Maiquetía",
  "Aérea de Valencia",
  "Carúpano",
  "Centro-Occidental",
  "Ciudad Guayana",
  "El Guamache",
  "Guanta-Puerto La Cruz",
  "Güiria",
  "La Guaira",
  "Las Piedras-Paraguaná",
  "Los Llanos Centrales",
  "Maracaibo",
  "Postal de Caracas",
  "Puerto Ayacucho",
  "Puerto Cabello",
  "Puerto Sucre",
  "San Antonio del Táchira",
] as const;

export type AduanaVenezuela = (typeof ADUANAS_VENEZUELA)[number];

/** Alias frecuentes (OCR / carga) → nombre canónico del catálogo. */
const ADUANA_ALIASES: Record<string, AduanaVenezuela> = {
  guanta: "Guanta-Puerto La Cruz",
  "puerto la cruz": "Guanta-Puerto La Cruz",
  "guanta puerto la cruz": "Guanta-Puerto La Cruz",
  "guanta-puerto la cruz": "Guanta-Puerto La Cruz",
  guamache: "El Guamache",
  "el guamache": "El Guamache",
  margarita: "El Guamache",
  "la guaira": "La Guaira",
  guaira: "La Guaira",
  "puerto cabello": "Puerto Cabello",
  maiquetia: "Aérea de Maiquetía",
  maiquetía: "Aérea de Maiquetía",
  "aerea de maiquetia": "Aérea de Maiquetía",
  "aérea de maiquetía": "Aérea de Maiquetía",
  maracaibo: "Maracaibo",
  "san antonio": "San Antonio del Táchira",
  "san antonio del tachira": "San Antonio del Táchira",
  "san antonio del táchira": "San Antonio del Táchira",
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
  "las piedras": "Las Piedras-Paraguaná",
  paraguaná: "Las Piedras-Paraguaná",
  paraguana: "Las Piedras-Paraguaná",
  "los llanos": "Los Llanos Centrales",
  "los llanos centrales": "Los Llanos Centrales",
  "centro occidental": "Centro-Occidental",
  "centro-occidental": "Centro-Occidental",
  "postal de caracas": "Postal de Caracas",
  "aerea de valencia": "Aérea de Valencia",
  "aérea de valencia": "Aérea de Valencia",
  valencia: "Aérea de Valencia",
};

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
}

/** Resuelve texto libre (OCR) al nombre del catálogo cuando es posible. */
export function resolveAduanaVenezuela(value: string | null | undefined): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";
  const exact = ADUANAS_VENEZUELA.find((a) => a.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const alias = ADUANA_ALIASES[normalizeKey(raw)];
  if (alias) return alias;
  const partial = ADUANAS_VENEZUELA.find((a) => {
    const key = normalizeKey(a);
    const n = normalizeKey(raw);
    return key.includes(n) || n.includes(key);
  });
  return partial ?? raw;
}
