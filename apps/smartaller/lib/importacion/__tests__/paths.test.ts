import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_COLA_DESADUANAMIENTO_ID,
  DASHBOARD_COLA_LLEGADA_ID,
  DASHBOARD_COLA_MATRICULA_ID,
  DASHBOARD_COLA_PLACA_ID,
  DASHBOARD_COLA_PROPIETARIO_ID,
  DASHBOARD_COLA_REGISTRO_ID,
  DASHBOARD_COLA_SEGURO_ID,
  hrefAfterFase2Embarque,
  hrefDashboardCola,
  hrefDashboardColaLlegada,
  SMARTIMPORT_DEMO_EXPEDIENTE_PATH,
  SMARTIMPORT_DEMO_FASES_PATH,
  SMARTIMPORT_DEMO_PATH,
} from "../paths";

describe("hrefAfterFase2Embarque", () => {
  it("Continuar a Llegada abre la fase 3 de la planilla", () => {
    assert.equal(
      hrefAfterFase2Embarque("next", "abc-uuid"),
      "/smartimport/abc-uuid/planilla?fase=3"
    );
  });

  it("sin expediente, Continuar a Llegada va a la cola de llegada", () => {
    assert.equal(hrefAfterFase2Embarque("next", "  "), hrefDashboardColaLlegada());
    assert.equal(hrefDashboardColaLlegada(), `/smartimport#${DASHBOARD_COLA_LLEGADA_ID}`);
  });

  it("Guardar e ir a la ficha abre el expediente", () => {
    assert.equal(
      hrefAfterFase2Embarque("ficha", "abc-uuid"),
      "/smartimport/abc-uuid"
    );
  });
});

describe("colas dashboard", () => {
  it("llegada tiene ancla propia", () => {
    assert.equal(DASHBOARD_COLA_LLEGADA_ID, "cola-llegada");
  });

  it("propietario tiene ancla propia", () => {
    assert.equal(DASHBOARD_COLA_PROPIETARIO_ID, "cola-propietario");
  });

  it("seguro y matrícula tienen ancla propia", () => {
    assert.equal(DASHBOARD_COLA_SEGURO_ID, "cola-seguro");
    assert.equal(DASHBOARD_COLA_MATRICULA_ID, "cola-matricula");
    assert.equal(DASHBOARD_COLA_PLACA_ID, "cola-placa");
  });

  it("registro y desaduanamiento también tienen ancla", () => {
    assert.equal(DASHBOARD_COLA_REGISTRO_ID, "cola-registro");
    assert.equal(DASHBOARD_COLA_DESADUANAMIENTO_ID, "cola-desaduanamiento");
    assert.equal(hrefDashboardCola(1), "/smartimport#cola-registro");
    assert.equal(hrefDashboardCola(4), "/smartimport#cola-desaduanamiento");
  });
});

describe("demo cliente", () => {
  it("la ruta del demo cuelga de /smartimport", () => {
    assert.equal(SMARTIMPORT_DEMO_PATH, "/smartimport/demo");
    assert.equal(
      SMARTIMPORT_DEMO_EXPEDIENTE_PATH,
      "/smartimport/expediente-demo"
    );
    assert.equal(SMARTIMPORT_DEMO_FASES_PATH, "/smartimport/demo-fases");
  });
});
