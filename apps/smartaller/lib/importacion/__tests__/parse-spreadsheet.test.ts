import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCargaMasivaXlsxBuffer, parseSpreadsheetBuffer } from "../parse-spreadsheet";

describe("parse-spreadsheet SheetJS", () => {
  it("genera xlsx de plantilla y lo vuelve a leer", () => {
    const buffer = buildCargaMasivaXlsxBuffer();
    assert.ok(buffer.length > 0);
    const parsed = parseSpreadsheetBuffer(buffer, "plantilla.xlsx");
    assert.equal(parsed.error, undefined);
    assert.ok((parsed.rows.length ?? 0) >= 1);
    const first = parsed.rows[0];
    assert.equal(first?.marca, "Toyota");
    assert.ok(first?.serialCarroceria);
  });

  it("lee csv con columnas obligatorias", () => {
    const csv = Buffer.from(
      "marca,serial_carroceria,modelo\nChery,LVVDB11B8ND123456,Tiggo\n",
      "utf8"
    );
    const parsed = parseSpreadsheetBuffer(csv, "lote.csv");
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.rows[0]?.marca, "Chery");
  });
});
