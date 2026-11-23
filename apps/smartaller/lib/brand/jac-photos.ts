/**
 * Fotos oficiales de modelos JAC (jacvenezuela.com), optimizadas a webp.
 * Mapa modelo → archivo, con respaldo genérico.
 */
export const JAC_CAR_PHOTOS = {
  "tepuy-pro": "/brands/jac/cars/tepuy-pro.webp",
  "venezolana-pro": "/brands/jac/cars/venezolana-pro.webp",
  "arena-sport": "/brands/jac/cars/arena-sport.webp",
  "arena-pro": "/brands/jac/cars/arena-pro.webp",
  nevado: "/brands/jac/cars/nevado.webp",
  "nevado-pro": "/brands/jac/cars/nevado-pro.webp",
  savanna: "/brands/jac/cars/savanna.webp",
  aventura: "/brands/jac/cars/aventura.webp",
  "aventura-pro": "/brands/jac/cars/aventura-pro.webp",
  gx7: "/brands/jac/cars/gx7.webp",
  fallback: "/brands/jac/cars/fallback.webp",
} as const;

export type JacCarPhotoId = keyof typeof JAC_CAR_PHOTOS;

const ALIASES: { match: RegExp; id: JacCarPhotoId }[] = [
  { match: /tepuy/, id: "tepuy-pro" },
  { match: /t8\s*pro|t8pro/, id: "tepuy-pro" },
  { match: /\bt8\b/, id: "tepuy-pro" },
  { match: /venezolana\s*pro|venezolanapro/, id: "venezolana-pro" },
  { match: /venezolana|hunter/, id: "venezolana-pro" },
  { match: /arena\s*sport/, id: "arena-sport" },
  { match: /arena\s*pro/, id: "arena-pro" },
  { match: /\barena\b/, id: "arena-sport" },
  { match: /nevado\s*pro/, id: "nevado-pro" },
  { match: /nevado/, id: "nevado" },
  { match: /savanna|js8/, id: "savanna" },
  { match: /aventura\s*pro/, id: "aventura-pro" },
  { match: /aventura/, id: "aventura" },
  { match: /gx7|js4/, id: "gx7" },
  { match: /js3/, id: "nevado" },
  { match: /js2/, id: "arena-sport" },
  { match: /t6/, id: "venezolana-pro" },
];

function normalizeModelo(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getJacCarPhotoId(modelo?: string | null): JacCarPhotoId {
  const key = normalizeModelo(modelo);
  if (!key) return "fallback";
  for (const alias of ALIASES) {
    if (alias.match.test(key)) return alias.id;
  }
  return "fallback";
}

export function getJacCarPhoto(modelo?: string | null): string {
  return JAC_CAR_PHOTOS[getJacCarPhotoId(modelo)];
}

/** Foto de login (Tepuy Pro, maqueta aprobada). */
export const JAC_LOGIN_HERO_PHOTO = JAC_CAR_PHOTOS["tepuy-pro"];
