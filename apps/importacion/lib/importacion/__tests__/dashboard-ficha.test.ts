import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dashboardFichaIdentidad,
  dashboardFichaLineas,
} from "../dashboard-ficha";

describe("dashboardFichaIdentidad", () => {
  it("pone marca, modelo, color y VIN en líneas separadas", () => {
    const ficha = dashboardFichaIdentidad({
      marca: "Chery",
      modelo: "Arrizo 5 Pro",
      color: "PHANTOM GRAY",
      vin: "LVVDB21B9VE033523",
    });
    assert.deepEqual(dashboardFichaLineas(ficha), [
      "Chery",
      "Arrizo 5 Pro",
      "PHANTOM GRAY",
      "LVVDB21B9VE033523",
    ]);
  });

  it("omite POR-COMPLETAR y vacíos", () => {
    const ficha = dashboardFichaIdentidad({
      marca: "Chery",
      modelo: "POR-COMPLETAR",
      color: "  ",
      vin: null,
    });
    assert.deepEqual(dashboardFichaLineas(ficha), ["Chery"]);
  });
});
