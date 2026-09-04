import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completarEtapaLabel,
  porCompletarEtapaTitle,
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

  it("avanza etapa por etapa hasta placa", () => {
    assert.equal(completarEtapaLabel(3), "Completar llegada");
    assert.equal(completarEtapaLabel(4), "Completar desaduanamiento");
    assert.equal(completarEtapaLabel(5), "Completar pago impuesto");
    assert.equal(completarEtapaLabel(6), "Completar inspección");
    assert.equal(completarEtapaLabel(7), "Completar propietario");
    assert.equal(completarEtapaLabel(8), "Completar seguro");
    assert.equal(completarEtapaLabel(9), "Completar matrícula");
    assert.equal(completarEtapaLabel(10), "Completar placa");
    assert.equal(resolvePlanillaEtapaPendiente(10), 10);
    assert.equal(resolvePlanillaEtapaPendiente(11), 10);
    assert.equal(completarEtapaLabel(11), "Completar placa");
  });

  it("títulos de cola van fase a fase", () => {
    assert.equal(porCompletarEtapaTitle(1), "Por completar registro");
    assert.equal(porCompletarEtapaTitle(2), "Por completar embarque");
    assert.equal(porCompletarEtapaTitle(3), "Por completar llegada");
    assert.equal(porCompletarEtapaTitle(4), "Por completar desaduanamiento");
    assert.equal(porCompletarEtapaTitle(5), "Por completar pago impuesto");
    assert.equal(porCompletarEtapaTitle(6), "Por completar inspección");
    assert.equal(porCompletarEtapaTitle(7), "Por completar propietario");
    assert.equal(porCompletarEtapaTitle(8), "Por completar seguro");
    assert.equal(porCompletarEtapaTitle(9), "Por completar matrícula");
    assert.equal(porCompletarEtapaTitle(10), "Por completar placa");
  });
});
