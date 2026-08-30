import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCheryCommercialInvoice,
  parseCheryInvoiceHeader,
  parseCheryInvoiceLineas,
  parseEuropeanMoney,
} from "../chery-invoice-lines";
import { applyCheryCommercialInvoice } from "../factura-row-fidelity";

/** Texto aplanado como lo deja unpdf / OCR de Factura_f2f2 (Chery Intercontinental). */
const FACTURA_F2F2 = `
COMMERCIAL INVOICE INVOICE NO. 18364-Z202603N0205 DATE 14 AUG 2026
SELLER INTERCONTINENTAL AUTOMOBILE TRADING
CONSIGNEE: IKSAN MOTORS, S.A. RIF J-500353343 CARACAS VENEZUELA
DESTINATION: El Guamache COUNTRY OF ORIGIN OF GOODS: CHINA
MARKS AND NUMBERS CODE DESCRIPTION QTY UNIT PRICE AMOUNT
CIF 11.014 11.014
TIGGO 2 PRO MAX LVVDB21B9VE033523 NASDAQ SILVER
TIGGO 2 PRO MAX LVVDB21B1VE033189 NASDAQ SILVER
TIGGO 2 PRO MAX LVD82189VE033215 NASDAQ SILVER
TIGGO 2 PRO MAX LVVDB21BXVE033580 NASDAQ SILVER
TIGGO 2 PRO MAX LWVDB2187VE033214 NASDAQ SILVER
TIGGO 2 PRO MAX LWDB2188VE033514 NASDAQ SILVER
TIGGO 2 PRO MAX LWVDB21B5VE033213 NASDAQ SILVER
TIGGO 2 PRO MAX LWD821B5VE033180 NASDAQ SILVER
TOTAL CIF 88.112 CHERY
`.replace(/\s+/g, " ");

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

describe("parseCheryInvoiceHeader", () => {
  it("convierte CIF europeo 11.014 en 11014", () => {
    assert.equal(parseEuropeanMoney("11.014"), 11014);
    assert.equal(parseEuropeanMoney("88.112"), 88112);
  });

  it("lee consignatario, RIF, destino, factura y CIF de Factura_f2f2", () => {
    const header = parseCheryInvoiceHeader(FACTURA_F2F2);
    assert.match(header.consignatario ?? "", /Iksan Motors/i);
    assert.equal(header.rif, "J-500353343");
    assert.match(header.destino ?? "", /Guamache/i);
    assert.equal(header.numeroFactura, "18364-Z202603N0205");
    assert.equal(header.cifUnitario, 11014);
    assert.equal(header.paisOrigen, "China");
    assert.equal(header.marca, "Chery");
  });

  it("asigna el mismo CIF a cada VIN de la factura", () => {
    const { lineas, header } = parseCheryCommercialInvoice(FACTURA_F2F2);
    assert.equal(header.cifUnitario, 11014);
    assert.equal(lineas.length, 8);
    assert.ok(lineas.every((r) => r.valorCif === 11014));
    assert.ok(lineas.some((r) => r.vin === "LVVDB21B9VE033523"));
    assert.ok(lineas.some((r) => r.vin === "LVVDB2187VE033214"));
  });

  it("tolera OCR ruidoso (I→1, Guamache, factura compacta)", () => {
    const noisy =
      "CONSIGNEE I1KSAN MOTORS S.A. RIF J-500353343 DESTINATION El GU4MACHE INVOICE 18364-Z202603N0205 CIF 11.014 TIGGO 2 PRO MAX LVVDB21B9VE033523 NASDAQ SILVER";
    const header = parseCheryInvoiceHeader(noisy);
    assert.match(header.consignatario ?? "", /Iksan/i);
    assert.equal(header.rif, "J-500353343");
    assert.equal(header.destino, "El Guamache");
    assert.equal(header.numeroFactura, "18364-Z202603N0205");
    assert.equal(header.cifUnitario, 11014);
  });
});

describe("applyCheryCommercialInvoice", () => {
  it("rellena consignatario, destino, factura y CIF en cada fila", () => {
    const applied = applyCheryCommercialInvoice(
      {
        shared: { marca: "Chery" },
        vehiculos: [
          {
            vin: "LVVDB21B9VE033523",
            serialCarroceria: "LVVDB21B9VE033523",
            marca: "Chery",
          },
        ],
      },
      FACTURA_F2F2
    );
    const row = applied.vehiculos[0];
    assert.match(applied.shared.importadorNombre ?? "", /Iksan/i);
    assert.equal(applied.shared.importadorDocumento, "J-500353343");
    assert.match(applied.shared.puerto ?? "", /Guamache/i);
    assert.equal(row?.valorCif, "11014");
    assert.match(row?.observaciones ?? "", /18364-Z202603N0205/);
    assert.match(row?.importadorNombre ?? "", /Iksan/i);
  });
});
