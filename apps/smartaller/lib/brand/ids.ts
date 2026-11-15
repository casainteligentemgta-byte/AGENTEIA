import { BRAND_IDS, type BrandId } from "@/lib/brand/types";

export const DEFAULT_BRAND_ID: BrandId = "smarttaller";

export function parseBrandId(raw: string | undefined | null): BrandId {
  const value = raw?.trim().toLowerCase();
  if (value && (BRAND_IDS as readonly string[]).includes(value)) {
    return value as BrandId;
  }
  return DEFAULT_BRAND_ID;
}

/** Marca activa. `NEXT_PUBLIC_BRAND=smarttaller|jac`. Por defecto smarttaller. */
export function getBrandId(): BrandId {
  return parseBrandId(process.env.NEXT_PUBLIC_BRAND);
}
