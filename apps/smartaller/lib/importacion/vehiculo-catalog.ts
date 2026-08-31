/**
 * Catálogo de marcas/modelos frecuentes en importación / Puerto Libre.
 * No pretende ser exhaustivo: incluye "Otra" en la UI para texto libre.
 */

export const VEHICULO_MARCAS_MODELOS: Record<string, string[]> = {
  Toyota: [
    "Corolla",
    "Camry",
    "Yaris",
    "RAV4",
    "Hilux",
    "Fortuner",
    "Land Cruiser",
    "Prado",
    "4Runner",
    "Tacoma",
    "Tundra",
    "Sequoia",
    "Highlander",
    "Sienna",
    "Avalon",
  ],
  Chevrolet: [
    "Spark",
    "Aveo",
    "Sail",
    "Onix",
    "Cruze",
    "Malibu",
    "Traverse",
    "Equinox",
    "Trailblazer",
    "Tahoe",
    "Suburban",
    "Silverado",
    "Colorado",
    "Captiva",
  ],
  Ford: [
    "Fiesta",
    "Focus",
    "Fusion",
    "Mustang",
    "Escape",
    "Edge",
    "Explorer",
    "Expedition",
    "Ranger",
    "F-150",
    "Bronco",
    "Maverick",
  ],
  Nissan: [
    "March",
    "Versa",
    "Sentra",
    "Altima",
    "Maxima",
    "Kicks",
    "X-Trail",
    "Rogue",
    "Pathfinder",
    "Frontier",
    "Titan",
    "Armada",
    "Murano",
  ],
  Hyundai: [
    "Accent",
    "Elantra",
    "Sonata",
    "Tucson",
    "Santa Fe",
    "Creta",
    "Kona",
    "Palisade",
    "Venue",
    "Ioniq",
  ],
  Kia: [
    "Rio",
    "Forte",
    "Cerato",
    "Sportage",
    "Sorento",
    "Seltos",
    "Soul",
    "Carnival",
    "Telluride",
    "Picanto",
  ],
  Honda: [
    "Civic",
    "Accord",
    "City",
    "Fit",
    "CR-V",
    "HR-V",
    "Pilot",
    "Passport",
    "Odyssey",
    "Ridgeline",
  ],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-50", "CX-9", "MX-5"],
  Volkswagen: [
    "Gol",
    "Polo",
    "Jetta",
    "Passat",
    "Tiguan",
    "Taos",
    "Atlas",
    "Amarok",
    "Virtus",
    "Nivus",
  ],
  Mitsubishi: ["Lancer", "Mirage", "ASX", "Outlander", "Montero", "L200", "Xpander"],
  Suzuki: ["Swift", "Dzire", "Vitara", "Jimny", "S-Cross", "Ertiga", "Baleno"],
  Jeep: ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator"],
  Dodge: ["Journey", "Durango", "Charger", "Challenger", "Ram 1500"],
  RAM: ["1500", "2500", "3500"],
  BMW: ["Serie 1", "Serie 3", "Serie 5", "X1", "X3", "X5", "X6", "X7"],
  "Mercedes-Benz": ["Clase A", "Clase C", "Clase E", "GLA", "GLC", "GLE", "GLS", "Clase G"],
  Audi: ["A3", "A4", "A6", "Q3", "Q5", "Q7", "Q8"],
  Chery: [
    "Tiggo 2",
    "Tiggo 2 Pro",
    "Tiggo 2 Pro Max",
    "Tiggo 3",
    "Tiggo 4",
    "Tiggo 7",
    "Tiggo 7 Pro",
    "Tiggo 7 Pro Max",
    "Tiggo 8",
    "Tiggo 8 Pro",
    "Tiggo 8 Pro Max",
    "Arrizo 5",
    "Arrizo 5 Pro",
    "Arrizo 8",
  ],
  BAIC: ["BJ40", "X35", "X55", "X65", "EU5"],
  BYD: ["Song Plus", "Yuan Plus", "Tang", "Han", "Dolphin", "Seal", "Atto 3"],
  "Great Wall": ["Haval H6", "Haval Jolion", "Poer", "Wingle"],
  GAC: ["GS3", "GS4", "GS8", "Emkoo"],
  Geely: ["Coolray", "Azkarra", "Okavango", "Geometry C"],
  Changan: ["CS35", "CS55", "CS75", "Alsvin", "Hunter"],
  Jac: ["S2", "S3", "S4", "T8", "Sei 2"],
  MG: ["ZS", "HS", "RX5", "MG5", "MG3"],
  Lexus: ["UX", "NX", "RX", "GX", "LX", "ES", "IS"],
  Subaru: ["Impreza", "Legacy", "Forester", "Outback", "Crosstrek", "Ascent"],
  Isuzu: ["D-Max", "MU-X"],
  Peugeot: ["208", "301", "2008", "3008", "5008"],
  Renault: ["Logan", "Sandero", "Duster", "Koleos", "Oroch", "Captur"],
};

export const VEHICULO_MARCAS = Object.keys(VEHICULO_MARCAS_MODELOS).sort((a, b) =>
  a.localeCompare(b, "es")
);

export const VEHICULO_COLORES = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Rojo",
  "Azul",
  "Verde",
  "Beige",
  "Dorado",
  "Marrón",
  "Naranja",
  "Amarillo",
  "Vino / Bordeaux",
  "Champagne",
] as const;

export const VEHICULO_CATALOGO_OTRA = "__otra__";

export function modelosDeMarca(marca: string): string[] {
  const resolved = resolveMarcaCatalogo(marca);
  return (resolved && VEHICULO_MARCAS_MODELOS[resolved]) || [];
}

/** Empareja «CHERY», «Chery Automobile», etc. con el catálogo. */
export function resolveMarcaCatalogo(marca: string): string | null {
  const trimmed = marca.trim();
  if (!trimmed) return null;
  const exact = VEHICULO_MARCAS.find((item) => item === trimmed);
  if (exact) return exact;
  const folded = trimmed.toLocaleLowerCase("es");
  const ci = VEHICULO_MARCAS.find(
    (item) => item.toLocaleLowerCase("es") === folded
  );
  if (ci) return ci;
  return (
    VEHICULO_MARCAS.find((item) => {
      const name = item.toLocaleLowerCase("es");
      return folded.includes(name) || name.includes(folded);
    }) ?? null
  );
}

export function aniosVehiculoCatalogo(anioMax = new Date().getFullYear() + 1): number[] {
  const min = 1990;
  const years: number[] = [];
  for (let y = anioMax; y >= min; y--) years.push(y);
  return years;
}
