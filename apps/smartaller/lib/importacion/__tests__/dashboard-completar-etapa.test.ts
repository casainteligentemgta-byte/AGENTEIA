import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completarEtapaLabel,
  resolvePlanillaEtapaPendiente,
} from "../dashboard-completar-etapa";

describe("completarEtapaLabel", () => {
  it("si el registro no está listo pide Completar registro", () => {
    assert.equal(completarEtapaLabel(1), "Completar registro");
    assert.equal(completarEtapaLabel(null), "Completar registro");
  });

  it("si el registro está listo pide Completar embarque", () => {
    assert.equal(completarEtapaLabel(2), "Completar embarque");
  });

  it("avanza etapa por etapa hasta matrícula", () => {
    assert.equal(completarEtapaLabel(3), "Completar llegada");
    assert.equal(completarEtapaLabel(4), "Completar desaduanamiento");
    assert.equal(completarEtapaLabel(5), "Completar propietario");
    assert.equal(completarEtapaLabel(6), "Completar seguro");
    assert.equal(completarEtapaLabel(7), "Completar matrícula");
    assert.equal(resolvePlanillaEtapaPendiente(8), 7);
    assert.equal(completarEtapaLabel(8), "Completar matrícula");
  });
});
