import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyCargaMasivaRow } from "../carga-masiva-template";
import {
  applyColumnValueToRows,
  applySharedLoteTechToRows,
  cargaMasivaRowStripeClass,
  cargaMasivaStickyIndexCellClass,
  EMPTY_SHARED_LOTE_TECH,
  groupByBlAndContainer,
  persistLoteTechOnRows,
  SIN_BL_LABEL,
  SIN_CONTENEDOR_LABEL,
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

describe("tabla carga masiva", () => {
  it("alterna gris clarito y transparente por fila", () => {
    const even = cargaMasivaRowStripeClass(0);
    const odd = cargaMasivaRowStripeClass(1);
    assert.match(even, /bg-slate-800/);
    assert.match(odd, /bg-transparent/);
    assert.notEqual(even, odd);
  });

  it("la celda # sticky sigue el cebra, no el semáforo", () => {
    const even = cargaMasivaStickyIndexCellClass(0, false);
    const odd = cargaMasivaStickyIndexCellClass(1, false);
    assert.match(even, /bg-slate-800/);
    assert.match(odd, /bg-slate-950/);
    assert.doesNotMatch(even, /bg-red-950|bg-amber-950/);
  });

  it("copia la primera celda a todas las filas de esa columna", () => {
    const rows = [
      emptyCargaMasivaRow({ id: "a", color: "" }),
      emptyCargaMasivaRow({ id: "b", color: "Rojo" }),
      emptyCargaMasivaRow({ id: "c", color: "" }),
    ];
    const next = applyColumnValueToRows(rows, "color", "Blanco");
    assert.equal(next[0]?.color, "Blanco");
    assert.equal(next[1]?.color, "Blanco");
    assert.equal(next[2]?.color, "Blanco");
    assert.equal(rows[1]?.color, "Rojo");
  });
});

describe("groupByBlAndContainer", () => {
  it("agrupa primero por BL y luego por contenedor", () => {
    const rows = [
      emptyCargaMasivaRow({
        id: "1",
        numeroBl: "BL-AAA",
        numeroContenedor: "CMAU7117837",
        vin: "LVVDB21B9VE033523",
      }),
      emptyCargaMasivaRow({
        id: "2",
        numeroBl: "BL-AAA",
        numeroContenedor: "CMAU6237057",
        vin: "LVVDB21B8VE033514",
      }),
      emptyCargaMasivaRow({
        id: "3",
        numeroBl: "BL-AAA",
        numeroContenedor: "CMAU7117837",
        vin: "LVVDB21B1VE033189",
      }),
    ];
    const groups = groupByBlAndContainer(rows);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.label, "BL-AAA");
    assert.equal(groups[0]?.contenedores.length, 2);
    assert.equal(groups[0]?.contenedores[0]?.label, "CMAU7117837");
    assert.equal(groups[0]?.contenedores[0]?.items.length, 2);
    assert.equal(groups[0]?.contenedores[1]?.label, "CMAU6237057");
    assert.equal(groups[0]?.total, 3);
  });

  it("usa etiquetas Sin BL / Sin contenedor si faltan", () => {
    const groups = groupByBlAndContainer([
      emptyCargaMasivaRow({ id: "1", vin: "LVVDB21B9VE033523" }),
    ]);
    assert.equal(groups[0]?.label, SIN_BL_LABEL);
    assert.equal(groups[0]?.contenedores[0]?.label, SIN_CONTENEDOR_LABEL);
  });
});
