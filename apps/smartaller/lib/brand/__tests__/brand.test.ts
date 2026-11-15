import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DEFAULT_BRAND_ID, getBrand, getBrandId, parseBrandId } from "@/lib/brand";
import { JAC_MODELS_PROVISIONAL } from "@/lib/brand/jac-models";
import {
  applyVehicleBrandFields,
  isAllowedModelo,
  validateVehicleBrand,
} from "@/lib/brand/catalog";
import { getHealthThresholds, getNextServiceInterval } from "@/lib/brand/intervals";
import { SMARTTALLER_BRAND } from "@/lib/brand/smarttaller";

const BRAND_KEYS = ["NEXT_PUBLIC_BRAND", "NEXT_PUBLIC_JAC_MODELS"] as const;
const snapshot = Object.fromEntries(BRAND_KEYS.map((k) => [k, process.env[k]])) as Record<
  (typeof BRAND_KEYS)[number],
  string | undefined
>;

afterEach(() => {
  for (const k of BRAND_KEYS) {
    const v = snapshot[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("brand id", () => {
  it("por defecto es smarttaller", () => {
    delete process.env.NEXT_PUBLIC_BRAND;
    assert.equal(getBrandId(), DEFAULT_BRAND_ID);
    assert.equal(parseBrandId(undefined), "smarttaller");
    assert.equal(parseBrandId("no-existe"), "smarttaller");
    assert.equal(parseBrandId("JAC"), "jac");
  });
});

describe("smarttaller copy", () => {
  it("conserva nombre, colores y textos actuales", () => {
    delete process.env.NEXT_PUBLIC_BRAND;
    const brand = getBrand();
    assert.equal(brand.id, "smarttaller");
    assert.equal(brand.copy.name, "SmartTaller");
    assert.equal(brand.copy.proName, "SmartTaller Pro");
    assert.equal(brand.copy.chatName, "Chat Smartaller");
    assert.equal(brand.copy.whatsappReclamoLine, "Reclama el historial en SmartTaller:");
    assert.equal(brand.theme.colors.primary, "#0d9488");
    assert.equal(brand.theme.colors.accent, "#f97316");
    assert.equal(brand.productionHost, "smarttaller.xyz");
    assert.equal(brand.vehicleCatalog.locked, false);
    assert.equal(brand.copy.telegram.help, SMARTTALLER_BRAND.copy.telegram.help);
  });
});

describe("jac catalog", () => {
  it("fija marca JAC y exige un modelo de la lista provisional", () => {
    process.env.NEXT_PUBLIC_BRAND = "jac";
    const brand = getBrand();
    assert.equal(brand.copy.name, "JAC Taller");
    assert.equal(brand.productionHost, null);
    assert.equal(brand.vehicleCatalog.locked, true);
    assert.equal(brand.vehicleCatalog.lockedMarca, "JAC");
    assert.equal(brand.vehicleCatalog.modelsProvisional, true);
    assert.ok(JAC_MODELS_PROVISIONAL.includes("T8 Pro"));
    assert.ok(JAC_MODELS_PROVISIONAL.includes("JS4"));

    const applied = applyVehicleBrandFields({ marca: "Toyota", modelo: "t8 pro" });
    assert.equal(applied.marca, "JAC");
    assert.equal(applied.modelo, "T8 Pro");

    const invalid = validateVehicleBrand({ marca: "JAC", modelo: "Hilux" });
    assert.equal(invalid.ok, false);

    const missing = validateVehicleBrand({ marca: "JAC", modelo: "" });
    assert.equal(missing.ok, false);

    const telegram = validateVehicleBrand(
      { marca: null, modelo: null },
      { requireModelo: false }
    );
    assert.equal(telegram.ok, true);
    if (telegram.ok) assert.equal(telegram.marca, "JAC");

    assert.equal(isAllowedModelo("JS-4", brand.vehicleCatalog.models), true);
  });

  it("permite override de modelos por env", () => {
    process.env.NEXT_PUBLIC_BRAND = "jac";
    process.env.NEXT_PUBLIC_JAC_MODELS = "JS4, Hunter";
    const brand = getBrand();
    assert.deepEqual(brand.vehicleCatalog.models, ["JS4", "Hunter"]);
  });
});

describe("intervalos", () => {
  it("conserva 5000 km / 6 meses por defecto", () => {
    delete process.env.NEXT_PUBLIC_BRAND;
    const next = getNextServiceInterval();
    assert.equal(next.km, 5000);
    assert.equal(next.months, 6);
    const health = getHealthThresholds();
    assert.equal(health.kmAtencion, 5000);
    assert.equal(health.kmCritico, 7500);
    assert.equal(health.diasAtencion, 30);
  });

  it("JAC usa los mismos valores hasta que lleguen los de fábrica", () => {
    process.env.NEXT_PUBLIC_BRAND = "jac";
    const brand = getBrand();
    assert.equal(brand.maintenance.source, "factory-pending");
    assert.equal(getNextServiceInterval("T8 Pro").km, 5000);
    assert.equal(getNextServiceInterval("T8 Pro").months, 6);
  });
});
