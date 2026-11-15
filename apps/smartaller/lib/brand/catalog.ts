import { getBrand } from "@/lib/brand/config";

export type VehicleBrandFields = {
  marca?: string | null;
  modelo?: string | null;
};

export type VehicleBrandValidation =
  | { ok: true; marca: string | null; modelo: string | null }
  | { ok: false; error: string; path: "marca" | "modelo" };

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function resolveCatalogModelo(
  raw: string | null | undefined,
  models: readonly string[]
): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const exact = models.find((m) => m === trimmed);
  if (exact) return exact;
  const key = normalizeKey(trimmed);
  return models.find((m) => normalizeKey(m) === key) ?? null;
}

export function isAllowedModelo(
  raw: string | null | undefined,
  models: readonly string[]
): boolean {
  return resolveCatalogModelo(raw, models) != null;
}

export function applyVehicleBrandFields(
  input: VehicleBrandFields
): { marca: string | null; modelo: string | null } {
  const catalog = getBrand().vehicleCatalog;
  const marca = input.marca?.trim() || null;
  const modelo = input.modelo?.trim() || null;

  if (!catalog.locked || !catalog.lockedMarca) {
    return { marca, modelo };
  }

  const resolved = resolveCatalogModelo(modelo, catalog.models);
  return {
    marca: catalog.lockedMarca,
    modelo: resolved ?? modelo,
  };
}

export function validateVehicleBrand(
  input: VehicleBrandFields,
  options?: { requireModelo?: boolean }
): VehicleBrandValidation {
  const catalog = getBrand().vehicleCatalog;
  const applied = applyVehicleBrandFields(input);

  if (!catalog.locked) {
    return { ok: true, ...applied };
  }

  const requireModelo = options?.requireModelo ?? true;
  if (requireModelo && !applied.modelo) {
    return {
      ok: false,
      error: `Elige un modelo ${catalog.lockedMarca} de la lista`,
      path: "modelo",
    };
  }

  if (applied.modelo && !isAllowedModelo(applied.modelo, catalog.models)) {
    return {
      ok: false,
      error: `Modelo no válido para ${catalog.lockedMarca}. Elige uno de la lista.`,
      path: "modelo",
    };
  }

  if (applied.modelo) {
    return {
      ok: true,
      marca: applied.marca,
      modelo: resolveCatalogModelo(applied.modelo, catalog.models),
    };
  }

  return { ok: true, ...applied };
}

export function vehicleBrandErrorMessage(result: VehicleBrandValidation): string | null {
  return result.ok ? null : result.error;
}
