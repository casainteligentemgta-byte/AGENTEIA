import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IMPORTADOR_DOC_LABELS,
  IMPORTADOR_DOC_TIPOS,
  importadorDocUsaOcr,
  importadorDocsFaltantes,
  importadorDocsRequeridos,
  importadorDocsResumen,
  isImportadorDocTipo,
} from "../documentos";
import { parseImportadorDocumentos } from "../upload-documento";

describe("documentos del cliente", () => {
  it("pide RIF, cédula/pasaporte, domicilio e inscripción; acta solo si es jurídica", () => {
    assert.deepEqual(importadorDocsRequeridos("natural"), [
      "rif",
      "cedula",
      "constancia_domicilio",
      "comprobante_inscripcion_tributaria",
    ]);
    assert.deepEqual(importadorDocsRequeridos("juridica"), [
      ...IMPORTADOR_DOC_TIPOS,
    ]);
    assert.equal(
      IMPORTADOR_DOC_LABELS.rif,
      "RIF vigente (Registro de Información Fiscal)"
    );
    assert.equal(
      IMPORTADOR_DOC_LABELS.cedula,
      "Cédula de identidad o pasaporte (laminado y vigente)"
    );
    assert.equal(
      IMPORTADOR_DOC_LABELS.acta_constitutiva,
      "Acta constitutiva de la empresa"
    );
    assert.equal(IMPORTADOR_DOC_LABELS.constancia_domicilio, "Constancia de domicilio");
    assert.equal(
      IMPORTADOR_DOC_LABELS.comprobante_inscripcion_tributaria,
      "Comprobante de inscripción tributaria"
    );
  });

  it("marca faltantes si no hay archivo ni pendiente", () => {
    const faltan = importadorDocsFaltantes("natural", { rif: { url: "https://x" } });
    assert.deepEqual(faltan, [
      "cedula",
      "constancia_domicilio",
      "comprobante_inscripcion_tributaria",
    ]);
    assert.deepEqual(
      importadorDocsFaltantes(
        "natural",
        { rif: { url: "https://x" } },
        { cedula: true }
      ),
      ["constancia_domicilio", "comprobante_inscripcion_tributaria"]
    );
    assert.deepEqual(importadorDocsResumen("juridica", {}), {
      cargados: 0,
      total: 5,
    });
  });

  it("OCR solo en RIF y cédula", () => {
    assert.equal(importadorDocUsaOcr("rif"), true);
    assert.equal(importadorDocUsaOcr("cedula"), true);
    assert.equal(importadorDocUsaOcr("acta_constitutiva"), false);
    assert.equal(isImportadorDocTipo("acta_constitutiva"), true);
    assert.equal(isImportadorDocTipo("titulo"), false);
  });

  it("parsea los cinco tipos desde JSON", () => {
    const parsed = parseImportadorDocumentos({
      rif: { url: "https://a", path: "a" },
      cedula: { url: "https://b", path: "b" },
      acta_constitutiva: { url: "https://c", path: "c", file_name: "acta.pdf" },
      constancia_domicilio: { url: "https://d", path: "d" },
      comprobante_inscripcion_tributaria: { url: "https://e", path: "e" },
    });
    assert.equal(parsed.acta_constitutiva?.file_name, "acta.pdf");
    assert.equal(parsed.comprobante_inscripcion_tributaria?.url, "https://e");
    assert.equal(Object.keys(parsed).length, 5);
  });
});
