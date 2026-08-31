import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isUsefulPdfText,
  pdfJsonExtractIsUsable,
  scorePdfJsonExtract,
} from "../../ai/document-json-completion";

describe("isUsefulPdfText", () => {
  it("rechaza watermark CamScanner con cabecera invoice sin tabla", () => {
    const text =
      "Scanned by CamScanner Commercial Invoice Seller Intercontinental Page 1 of 2";
    assert.equal(isUsefulPdfText(text), false);
  });

  it("acepta texto digital con varios VIN", () => {
    const text = `
COMMERCIAL INVOICE INVOICE NO. 18364-Z202605N0101-1A
MARKS AND NUMBERS CODE DESCRIPTION QTY UNIT PRICE
TIGGO 7 LVVDC21B5VD713650 NASDAQ SILVER 1 16,368.00
ARRIZO 5 PRO LVVDB21B9VE033523 CELADON GRAY 1 11,153.00
`.repeat(3);
    assert.equal(isUsefulPdfText(text), true);
  });

  it("acepta certificado con ENGINE No SQRF", () => {
    const text =
      "CERTIFICATE OF ORIGIN VIN NO ENGINE NO COLOUR SQRF4J16ELTC00007 LVVDC21B5VD713650 WHITE";
    assert.equal(isUsefulPdfText(text), true);
  });
});

describe("pdfJsonExtractIsUsable", () => {
  it("rechaza cabecera vacía aunque haya dos campos", () => {
    assert.equal(
      pdfJsonExtractIsUsable({
        marca: "Chery",
        pais_origen: "China",
        vehiculos: [],
      }),
      false
    );
  });

  it("acepta al menos un VIN en vehiculos", () => {
    const data = {
      vehiculos: [
        {
          serial_carroceria: "LVVDC21B5VD713650",
          modelo: "Tiggo 7",
        },
      ],
    };
    assert.ok(scorePdfJsonExtract(data) >= 10);
    assert.equal(pdfJsonExtractIsUsable(data), true);
  });
});
