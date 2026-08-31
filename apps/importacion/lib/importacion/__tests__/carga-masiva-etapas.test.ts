import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARGA_MASIVA_ETAPA_HINTS,
  cargaMasivaEtapasPlan,
  nextCargaMasivaEtapa,
} from "../carga-masiva-etapas";

describe("carga masiva etapas", () => {
  it("etapa VIN cosecha ~8 unidades, no OCR de 12 páginas", () => {
    assert.match(CARGA_MASIVA_ETAPA_HINTS.vins, /8 VIN/i);
    assert.equal(cargaMasivaEtapasPlan(true)[0], "vins");
  });

  it("con certificado: VIN → ENGINE No → enriquecer", () => {
    assert.deepEqual(cargaMasivaEtapasPlan(true), ["vins", "certs", "datos"]);
    assert.equal(nextCargaMasivaEtapa("vins", true), "certs");
    assert.equal(nextCargaMasivaEtapa("certs", true), "datos");
    assert.equal(nextCargaMasivaEtapa("datos", true), null);
  });

  it("sin certificado: VIN → enriquecer", () => {
    assert.deepEqual(cargaMasivaEtapasPlan(false), ["vins", "datos"]);
    assert.equal(nextCargaMasivaEtapa("vins", false), "datos");
    assert.equal(nextCargaMasivaEtapa("certs", false), "datos");
    assert.equal(nextCargaMasivaEtapa("datos", false), null);
  });

  it("cosecha VIN objetivo 8 en pág. 1 (no umbral 18 / 12 páginas)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, "../../extract-puerto-libre-docs.ts"),
      "utf8"
    );
    assert.match(src, /FACTURA_VIN_HARVEST_TARGET = 8/);
    assert.match(src, /maxPages: 1, scale: 2\.8/);
    assert.doesNotMatch(src, /MULTI_VIN_TARGET = 18/);
  });

  it("certs Extraer: 1× visión pág. 2 (VIN + ENGINE No + color)", () => {
    assert.match(CARGA_MASIVA_ETAPA_HINTS.certs, /ENGINE No/i);
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, "../../extract-puerto-libre-docs.ts"),
      "utf8"
    );
    assert.match(src, /CERT_ENGINE_PAIR_HARVEST_PROMPT/);
    assert.match(src, /STAGE_BUDGET_MS = rapido \? 38_000/);
    assert.match(src, /options\?\.rapido === true \|\|/);
  });
});
