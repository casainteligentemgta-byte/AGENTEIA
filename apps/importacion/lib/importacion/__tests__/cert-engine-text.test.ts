import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCertEngineNosFromPages,
  parseCertEngineNosFromText,
} from "../cert-engine-text";

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

  it("prioriza la página 2 (columna ENGINE No) frente a la carátula", () => {
    const page1 = `
      CERTIFICATE OF ORIGIN
      Consignee IKSAN MOTORS
      VIN LVVDC21B5VD713650
      VIN LVVDB21B9VD812001
    `;
    const page2 = `
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
      LVVDB21B9VD812001   C16TD98765432
    `;
    const pairs = parseCertEngineNosFromPages([page1, page2]);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1234567");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
  });

  it("asigna el primer ENGINE No huérfano bajo el encabezado al primer VIN", () => {
    const text = `
      VIN                 ENGINE NO
      SQRE4G15C1111111
      LVVDC21B5VD713650   NASDAQ SILVER
      LVVDB21B9VD812001   NASDAQ SILVER C16TD98765432
      LVVDB21B1VE033189   NASDAQ SILVER SQRE4T15C2408456
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 3);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1111111");
    assert.equal(byVin.LVVDB21B9VD812001, "C16TD98765432");
    assert.equal(byVin.LVVDB21B1VE033189, "SQRE4T15C2408456");
  });

  it("toma el motor de la 1ª fila si OCR lo deja en la línea siguiente", () => {
    const text = `
      LVVDC21B5VD713650 NASDAQ SILVER
      SQRE4G15C1111111
      LVVDB21B9VD812001 NASDAQ SILVER C16TD98765432
    `;
    const pairs = parseCertEngineNosFromText(text);
    const byVin = Object.fromEntries(pairs.map((p) => [p.vin, p.serialMotor]));
    assert.equal(pairs.length, 2);
    assert.equal(byVin.LVVDC21B5VD713650, "SQRE4G15C1111111");
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
