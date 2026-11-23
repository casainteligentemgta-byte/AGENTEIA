export { getBrandId, parseBrandId, DEFAULT_BRAND_ID } from "@/lib/brand/ids";
export { getBrand, getBrandTokens } from "@/lib/brand/config";
export { BRAND_IDS } from "@/lib/brand/types";
export type {
  BrandConfig,
  BrandCopy,
  BrandId,
  BrandMaintenanceSchedule,
  VehicleCatalog,
} from "@/lib/brand/types";
export {
  applyVehicleBrandFields,
  validateVehicleBrand,
  resolveCatalogModelo,
  isAllowedModelo,
} from "@/lib/brand/catalog";
export {
  getNextServiceInterval,
  getModuleInterval,
  getHealthThresholds,
} from "@/lib/brand/intervals";
export { JAC_MODELS_PROVISIONAL } from "@/lib/brand/jac-models";
export { getJacCarPhoto, JAC_LOGIN_HERO_PHOTO } from "@/lib/brand/jac-photos";
export { getJacServiceTheme, JAC_SERVICE_ORDER, JAC_CHIPS } from "@/lib/brand/jac-theme";
