import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  documentosConCopiaLote,
  isDocumentoLote,
  isSiblingDelMismoLote,
  mergeImportacionLote,
  normalizeLoteBlKey,
  pickImportacionLoteFields,
} from "../expediente-lote";

describe("expediente lote vs unidad", () => {
  it("factura, BL, DAV y póliza de transporte son del lote", () => {
    assert.equal(isDocumentoLote("factura_comercial"), true);
    assert.equal(isDocumentoLote("bl_guia"), true);
    assert.equal(isDocumentoLote("dav"), true);
    assert.equal(isDocumentoLote("poliza_transporte"), true);
    assert.equal(isDocumentoLote("lista_empaque"), true);
  });

  it("certificado, fotos, seguro y título son del vehículo", () => {
    assert.equal(isDocumentoLote("certificado_origen"), false);
    assert.equal(isDocumentoLote("foto_impronta"), false);
    assert.equal(isDocumentoLote("foto_frontal"), false);
    assert.equal(isDocumentoLote("poliza_seguro"), false);
    assert.equal(isDocumentoLote("manual_vehiculo"), false);
    assert.equal(isDocumentoLote("titulo"), false);
  });

  it("normaliza el BL para emparejar el grupo", () => {
    assert.equal(normalizeLoteBlKey(" cosu 123 "), "COSU123");
    assert.equal(sameBl("COSU123", "cosu 123"), true);
  });

  it("hermanos = mismo BL e importador", () => {
    assert.equal(
      isSiblingDelMismoLote(
        { numeroBl: "COSU123", importadorId: "imp-1" },
        { numeroBl: "cosu123", importadorId: "imp-1" }
      ),
      true
    );
    assert.equal(
      isSiblingDelMismoLote(
        { numeroBl: "COSU123", importadorId: "imp-1" },
        { numeroBl: "OTRO", importadorId: "imp-1" }
      ),
      false
    );
    assert.equal(
      isSiblingDelMismoLote(
        { numeroBl: "COSU123", importadorId: "imp-1" },
        { numeroBl: "COSU123", importadorId: "imp-2" }
      ),
      false
    );
  });

  it("el parche de lote no incluye CIF, contenedor ni observaciones", () => {
    const patch = pickImportacionLoteFields({
      numeroBl: "COSU123",
      puerto: "La Guaira",
      valorCif: 12000,
      numeroContenedor: "CMAU7117837",
      observaciones: "llave 3",
      planillaFase: 4,
    } as never);
    assert.equal(patch.numeroBl, "COSU123");
    assert.equal(patch.puerto, "La Guaira");
    assert.equal(patch.valorCif, undefined);
    assert.equal(patch.numeroContenedor, undefined);
    assert.equal(patch.observaciones, undefined);
    assert.equal("planillaFase" in patch, false);
  });

  it("al copiar lote conserva CIF y contenedor del hermano", () => {
    const merged = mergeImportacionLote(
      {
        valorCif: 8000,
        numeroContenedor: "CMAU1111111",
        observaciones: "unidad A",
        planillaFase: 2,
        numeroBl: "COSU123",
      },
      {
        numeroBl: "COSU123",
        puerto: "Guanta",
        valorCif: 12000,
        numeroContenedor: "XXXX0000000",
        observaciones: "no copiar",
        planillaFase: 5,
      }
    );
    assert.equal(merged.puerto, "Guanta");
    assert.equal(merged.valorCif, 8000);
    assert.equal(merged.numeroContenedor, "CMAU1111111");
    assert.equal(merged.observaciones, "unidad A");
    assert.equal(merged.planillaFase, 2);
  });

  it("copia la referencia del documento de lote", () => {
    const next = documentosConCopiaLote(
      { certificado_origen: { url: "https://x/c.pdf", path: "c" } },
      "lista_empaque",
      { url: "https://x/l.pdf", path: "l", file_name: "lista.pdf" }
    );
    assert.equal(next.lista_empaque?.path, "l");
    assert.equal(next.certificado_origen?.path, "c");
  });
});

function sameBl(a: string, b: string) {
  return normalizeLoteBlKey(a) === normalizeLoteBlKey(b);
}
