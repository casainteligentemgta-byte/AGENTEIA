import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_COLA_EMBARQUE_ID,
  DASHBOARD_COLA_MATRICULA_ID,
  DASHBOARD_COLA_PROPIETARIO_ID,
  DASHBOARD_COLA_SEGURO_ID,
  hrefAfterFase2Embarque,
} from "../paths";

describe("hrefAfterFase2Embarque", () => {
  it("Continuar a Llegada va al dashboard en la 2.ª cola", () => {
    assert.equal(
      hrefAfterFase2Embarque("next", "abc-uuid"),
      `/smartimport#${DASHBOARD_COLA_EMBARQUE_ID}`
    );
  });

  it("Guardar e ir a la ficha abre el expediente", () => {
    assert.equal(
      hrefAfterFase2Embarque("ficha", "abc-uuid"),
      "/smartimport/abc-uuid"
    );
  });
});

describe("colas dashboard", () => {
  it("propietario tiene ancla propia", () => {
    assert.equal(DASHBOARD_COLA_PROPIETARIO_ID, "cola-propietario");
  });

  it("seguro y matrícula tienen ancla propia", () => {
    assert.equal(DASHBOARD_COLA_SEGURO_ID, "cola-seguro");
    assert.equal(DASHBOARD_COLA_MATRICULA_ID, "cola-matricula");
  });
});
