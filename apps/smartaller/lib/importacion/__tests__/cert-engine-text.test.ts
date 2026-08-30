import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCertEngineNosFromText } from "../cert-engine-text";

describe("parseCertEngineNosFromText", () => {
  it("empareja VIN + ENGINE No en la misma línea (página 2)", () => {
    const text = `
      LVVDC21B5VD713650 ENGINE NO: C16TD1234567
      LVVDB21B9VD812001 ENGINE NO C16TD7654321
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 2);
    assert.equal(pairs[0]?.vin, "LVVDC21B5VD713650");
    assert.equal(pairs[0]?.serialMotor, "C16TD1234567");
    assert.equal(pairs[1]?.serialMotor, "C16TD7654321");
  });

  it("alinea motores etiquetados con VIN si hay la misma cantidad", () => {
    const text = `
      Chassis: LVVDC21B5VD713650
      Chassis: LVVDB21B9VD812001
      ENGINE NO ABC12XY345
      ENGINE NO DEF98ZW765
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "ABC12XY345");
    assert.equal(byVin.LVVDB21B9VD812001, "DEF98ZW765");
  });

  it("no toma el VIN como motor", () => {
    const text = "LVVDC21B5VD713650 ENGINE NO LVVDC21B5VD713650";
    assert.equal(parseCertEngineNosFromText(text).length, 0);
  });

  it("lee columna ENGINE No con un encabezado y N seriales", () => {
    const text = `
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
      LVVDB21B9VD812001   C16TD98765432
      DESCRIPTION
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1234567");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
  });

  it("toma el motor tras color en la misma fila que el VIN", () => {
    const text = "LVVDC21B5VD713650 NASDAQ SILVER SQRE4G15C5556667";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]?.vin, "LVVDC21B5VD713650");
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15C5556667");
  });
});
