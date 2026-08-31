import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyEngineNosByVin,
  assignEngineNosByRowOrder,
  collectEngineNosInOrder,
  harvestCertEnginesFromPages,
  harvestCertEnginesFromText,
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

  it("lista ENGINE No en orden aunque el VIN del COO no coincida", () => {
    const text = `
      ENGINE NO
      SQRE4G15C1111111
      C16TD2222222
      SQRE4T15C3333333
    `;
    assert.deepEqual(collectEngineNosInOrder(text), [
      "SQRE4G15C1111111",
      "C16TD2222222",
      "SQRE4T15C3333333",
    ]);
  });

  it("rellena motores vacíos por orden de fila (cruce VIN fallido)", () => {
    const rows = [
      { vin: "LVVDC21B5VD713650", serialMotor: "POR-COMPLETAR" },
      { vin: "LVVDB21B9VD812001", serialMotor: "" },
      { vin: "LVVDB21B1VE033189", serialMotor: "C16TD9999999" },
    ];
    const next = assignEngineNosByRowOrder(rows, [
      "SQRE4G15C1111111",
      "C16TD2222222",
      "C16TD9999999",
    ]);
    assert.equal(next[0]?.serialMotor, "SQRE4G15C1111111");
    assert.equal(next[1]?.serialMotor, "C16TD2222222");
    assert.equal(next[2]?.serialMotor, "C16TD9999999");
  });

  it("toma el motor tras color en la misma fila que el VIN", () => {
    const text = "LVVDC21B5VD713650 NASDAQ SILVER SQRE4G15C5556667";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0]?.vin, "LVVDC21B5VD713650");
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15C5556667");
  });

  it("cruza ENGINE No del COO con VIN de factura (LWV vs LVV)", () => {
    const rows = [
      { vin: "LVVDB21B9VE033523", serialCarroceria: "LVVDB21B9VE033523", serialMotor: "" },
      { vin: "LVVDB2187VE033214", serialCarroceria: "LVVDB2187VE033214", serialMotor: "" },
    ];
    const next = applyEngineNosByVin(rows, [
      { vin: "LWVDB21B9VE033523", serialMotor: "SQRE4G15C1111111" },
      { vin: "LWVDB2187VE033214", serialMotor: "C16TD2222222" },
    ]);
    assert.equal(next[0]?.serialMotor, "SQRE4G15C1111111");
    assert.equal(next[1]?.serialMotor, "C16TD2222222");
  });

  it("cosecha pares y columna ENGINE No del mismo texto", () => {
    const harvested = harvestCertEnginesFromText(`
      VIN                 ENGINE NO
      LVVDC21B5VD713650   SQRE4G15C1234567
      LVVDB21B9VD812001   C16TD98765432
    `);
    assert.equal(harvested.pairs.length, 2);
    assert.deepEqual(harvested.motors, ["SQRE4G15C1234567", "C16TD98765432"]);
  });

  it("toma todos los VIN+SQRE de una sola línea OCR", () => {
    const text =
      "LVVDB21B9VE033523 SQRE4G15CB0TC60412 LVVDB21B1VE033189 SQRE4G15CB0TC60341 LVVDB21B9VE033215 SQRE4G15CB0TC60200";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 3);
    assert.equal(pairs[2]?.serialMotor, "SQRE4G15CB0TC60200");
  });

  it("no se salta filas por lastIndex de regex /g entre llamadas", () => {
    parseCertEngineNosFromText(`
      VIN ENGINE NO
      LVVDC21B5VD713650 SQRE4G15C1111111
      LVVDB21B9VD812001 C16TD98765432
    `);
    const text = `
      LVVDC21B5VD713650 NASDAQ SILVER
      SQRE4G15C1111111
      LVVDB21B9VD812001 NASDAQ SILVER C16TD98765432
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 2);
  });

  it("extrae los 8 ENGINE No fila por fila (COO Chery)", () => {
    const text = `
      ITEM VIN NO. ENGINE NO. COLOUR
      1 LVVDB21B9VE033523 SQRE4G15CB0TC60412 NASDAQ SILVER
      2 LVVDB21B1VE033189 SQRE4G15CB0TC60341 CELADON GRAY
      3 LVVDB21B9VE033215 SQRE4G15CB0TC60200 CELADON GRAY
      4 LVVDB21B5VE033213 SQRE4G15CB0TC60173 NASDAQ SILVER
      5 LVVDB21B9VE033214 SQRE4G15CB0TC60100 CELADON GRAY
      6 LVVDB21B8VE033212 SQRE4G15CB0TC60099 NASDAQ SILVER
      7 LVVDB21B7VE033211 SQRE4G15CB0TC60098 CELADON GRAY
      8 LVVDB21B6VE033210 SQRE4G15CB0TC60097 NASDAQ SILVER
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 8);
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(pairs[7]?.vin, "LVVDB21B6VE033210");
    assert.equal(pairs[7]?.serialMotor, "SQRE4G15CB0TC60097");
  });

  it("separa motores SQRE pegados y los alinea en orden", () => {
    const text =
      "LVVDB21B9VE033523 LVVDB21B1VE033189 SQRE4G15CB0TC60412SQRE4G15CB0TC60341";
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 2);
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(pairs[1]?.serialMotor, "SQRE4G15CB0TC60341");
  });

  it("empareja VIN y SQRE4G15C en la misma fila (COO Chery pág. 2)", () => {
    const text = `
      ITEM VIN NO. ENGINE NO. COLOUR
      1 LVVDB21B9VE033523 SQRE4G15CB0TC60412 NASDAQ SILVER
      2 LVVDB21B1VE033189 SQRE4G15CB0TC60341 CELADON GRAY
      3 LVVDB21B9VE033215 SQRE4G15CB0TC60200 CELADON GRAY
    `;
    const pairs = parseCertEngineNosFromText(text);
    assert.equal(pairs.length, 3);
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60412");
    assert.equal(pairs[1]?.vin, "LVVDB21B1VE033189");
    assert.equal(pairs[1]?.serialMotor, "SQRE4G15CB0TC60341");
  });

  it("repara OCR S0RE → SQRE", () => {
    const pairs = parseCertEngineNosFromText(
      "LVVDB21B5VE033213 S0RE4G15CB0TC60173"
    );
    assert.equal(pairs[0]?.serialMotor, "SQRE4G15CB0TC60173");
  });

  it("si la pág. 2 está vacía, busca ENGINE No en otra página", () => {
    const harvested = harvestCertEnginesFromPages([
      "CERTIFICATE OF ORIGIN",
      "",
      `
        VIN                 ENGINE NO
        LVVDC21B5VD713650   SQRE4G15C1234567
        LVVDB21B9VD812001   C16TD98765432
      `,
    ]);
    assert.equal(harvested.pairs.length, 2);
    assert.equal(harvested.pairs[0]?.serialMotor, "SQRE4G15C1234567");
  });
});
