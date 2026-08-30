import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCheryInvoiceLineas } from "../chery-invoice-lines";

describe("parseCheryInvoiceLineas", () => {
  it("lee modelo, VIN y color de una línea Chery", () => {
    const text =
      "TIGGO 7 PRO LVVDC21B5VD713650 NASDAQ SILVER ENGINE NO C16TD1234567";
    const rows = parseCheryInvoiceLineas(text);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.vin, "LVVDC21B5VD713650");
    assert.match(rows[0]?.modelo ?? "", /TIGGO 7/i);
    assert.match(rows[0]?.color ?? "", /Nasdaq Silver/i);
    assert.equal(rows[0]?.serialMotor, "C16TD1234567");
  });

  it("repara WMI LWV a LVV", () => {
    const text = "ARRIZO 5 PRO LWVDC21B5VD713650 CELADON GRAY";
    const rows = parseCheryInvoiceLineas(text);
    assert.equal(rows[0]?.vin, "LVVDC21B5VD713650");
  });
});
