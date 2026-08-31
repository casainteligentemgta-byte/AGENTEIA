import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cargaMasivaEtapasPlan,
  nextCargaMasivaEtapa,
} from "../carga-masiva-etapas";

describe("carga masiva etapas", () => {
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
});
