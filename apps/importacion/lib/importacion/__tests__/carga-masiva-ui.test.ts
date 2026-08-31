import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyCargaMasivaRow } from "../carga-masiva-template";
import {
  applySharedLoteTechToRows,
  EMPTY_SHARED_LOTE_TECH,
  persistLoteTechOnRows,
} from "../carga-masiva-ui";

describe("lote técnico → tabla", () => {
  it("copia combustible a todas las filas al aplicar el lote", () => {
    const rows = [
      emptyCargaMasivaRow({ id: "a", vin: "LVVDB21B9VE033523" }),
      emptyCargaMasivaRow({ id: "b", vin: "LVVDB21B1VE033189" }),
    ];
    const next = applySharedLoteTechToRows(
      rows,
      { ...EMPTY_SHARED_LOTE_TECH, tipoCombustible: "gasolina" },
      { force: true }
    );
    assert.equal(next[0]?.tipoCombustible, "gasolina");
    assert.equal(next[1]?.tipoCombustible, "gasolina");
  });

  it("tras Extraer conserva el combustible elegido y lo escribe en filas vacías", () => {
    const extracted = [
      emptyCargaMasivaRow({
        id: "a",
        vin: "LVVDB21B9VE033523",
        tipoCombustible: "",
      }),
      emptyCargaMasivaRow({
        id: "b",
        vin: "LVVDB21B1VE033189",
        tipoCombustible: "",
      }),
    ];
    const { rows, tech } = persistLoteTechOnRows(extracted, {
      ...EMPTY_SHARED_LOTE_TECH,
      tipoCombustible: "gasolina",
    });
    assert.equal(tech.tipoCombustible, "gasolina");
    assert.equal(rows[0]?.tipoCombustible, "gasolina");
    assert.equal(rows[1]?.tipoCombustible, "gasolina");
  });

  it("no pisa un combustible distinto ya presente si no se fuerza", () => {
    const extracted = [
      emptyCargaMasivaRow({
        id: "a",
        vin: "LVVDB21B9VE033523",
        tipoCombustible: "diesel",
      }),
    ];
    const { rows } = persistLoteTechOnRows(extracted, {
      ...EMPTY_SHARED_LOTE_TECH,
      tipoCombustible: "gasolina",
    });
    assert.equal(rows[0]?.tipoCombustible, "diesel");
  });
});
