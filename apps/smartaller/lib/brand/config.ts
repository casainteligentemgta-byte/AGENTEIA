import { getBrandId } from "@/lib/brand/ids";
import { buildJacBrand } from "@/lib/brand/jac";
import { SMARTTALLER_BRAND } from "@/lib/brand/smarttaller";
import type { BrandConfig, BrandId } from "@/lib/brand/types";

export function getBrand(id: BrandId = getBrandId()): BrandConfig {
  if (id === "jac") return buildJacBrand();
  return SMARTTALLER_BRAND;
}

/** Compatibilidad con el token `BRAND` previo (colores + name). */
export function getBrandTokens() {
  const brand = getBrand();
  return {
    name: brand.copy.name,
    colors: brand.theme.colors,
  };
}
