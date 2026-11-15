export const BRAND_IDS = ["smarttaller", "jac"] as const;
export type BrandId = (typeof BRAND_IDS)[number];

export type BrandThemeMode = "color" | "mono";

export type BrandColors = {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryMuted: string;
  primaryDark: string;
  accent: string;
  dark: string;
  darkSurface: string;
  themeColor: string;
};

export type BrandAssets = {
  logoOnLight: string;
  logoOnDark: string;
  favicon: string;
  appleIcon: string;
};

export type VehicleCatalog = {
  locked: boolean;
  lockedMarca: string | null;
  /** Lista inicial sujeta a confirmación comercial (p. ej. JAC Venezuela). */
  modelsProvisional: boolean;
  models: readonly string[];
};

export type MaintenanceInterval = {
  km: number;
  months: number;
};

export type ModuleInterval = {
  km: number;
  months?: number;
};

export type BrandMaintenanceSchedule = {
  /**
   * `default-smarttaller`: mismos valores que la app actual.
   * `factory-pending`: estructura lista; JAC aún no entregó intervalos de fábrica.
   */
  source: "default-smarttaller" | "factory-pending";
  nextService: MaintenanceInterval;
  health: {
    kmAtencion: number;
    kmCritico: number;
    diasAtencion: number;
  };
  byModule: Record<string, ModuleInterval>;
  byModel: Record<string, Partial<{
    nextService: MaintenanceInterval;
    byModule: Record<string, ModuleInterval>;
  }>>;
};

export type BrandTelegramCopy = {
  help: string;
  inspeccionHint: string;
  recepcionPrompt: string;
  vinculado: (tallerNombre: string) => string;
  botLabel: string;
};

export type BrandLandingCopy = {
  homeTitle: string;
  homeDescription: string;
  heroAccent: string;
  headerAria: string;
  demoAria: string;
  demoBot: string;
  demoVehicle: string;
  demoWhatsApp: string;
  stepsWho: string;
  footerCredit: string;
  paraTalleresTitle: string;
  howItWorksDesc: string;
  howItWorksWhy: string;
  aboutP1: string;
  aboutP4: string;
  b2bHero: string;
  homeHero: string;
};

export type BrandCopy = {
  name: string;
  /** Partes del wordmark textual (Smart + Taller). JAC no lo usa: va el PNG. */
  wordmark?: { prefix: string; suffix: string };
  tagline: string;
  proName: string;
  assistantName: string;
  chatName: string;
  metaTitle: string;
  metaDescription: string;
  appleWebAppTitle: string;
  appTitle: string;
  pwaName: string;
  pwaShortName: string;
  pwaDescription: string;
  fallbackTallerNombre: string;
  emailFromName: string;
  emailFromFallback: string;
  emailFooter: string;
  recordatorioLinkLabel: string;
  whatsappReclamoLine: string;
  paywallBody: string;
  subscriptionActivated: string;
  needProVehicles: string;
  needProMantenimientos: string;
  needProCategorias: string;
  needProEstado: string;
  needProChat: string;
  landing: BrandLandingCopy;
  telegram: BrandTelegramCopy;
};

export type BrandConfig = {
  id: BrandId;
  /** Dominio de producción conocido. `null` = solo `NEXT_PUBLIC_SITE_URL`. */
  productionHost: string | null;
  theme: {
    mode: BrandThemeMode;
    colors: BrandColors;
  };
  assets: BrandAssets;
  copy: BrandCopy;
  vehicleCatalog: VehicleCatalog;
  maintenance: BrandMaintenanceSchedule;
};
