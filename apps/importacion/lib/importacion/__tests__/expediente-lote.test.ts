import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCUMENTO_TIPOS_CARGA_BL,
  DOCUMENTO_TIPOS_CARGA_BL_DESADUANA,
  DOCUMENTO_TIPOS_CARGA_BL_EMBARQUE,
  DOCUMENTO_TIPOS_CARGA_REGISTRO,
  cargaBlPath,
  countDocumentosCargaBl,
  documentosConCopiaLote,
  fillEmptyImportacionLote,
  groupByCargaBl,
  isDocumentoLote,
  isSiblingDelMismoLote,
  mergeDocumentosCargaBl,
  mergeImportacionLote,
  normalizeLoteBlKey,
  numeroBlFromScan,
  pickDocumentosLoteFaltantes,
  pickImportacionLoteFields,
} from "../expediente-lote";

describe("expediente lote vs unidad", () => {
  it("factura, certificado, BL, DAV y póliza de transporte son de la carga", () => {
    assert.equal(isDocumentoLote("factura_comercial"), true);
    assert.equal(isDocumentoLote("certificado_origen"), true);
    assert.equal(isDocumentoLote("bl_guia"), true);
    assert.equal(isDocumentoLote("dav"), true);
    assert.equal(isDocumentoLote("poliza_transporte"), true);
    assert.equal(isDocumentoLote("lista_empaque"), true);
  });

  it("fotos, seguro y título son del vehículo", () => {
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
    assert.equal("partidaArancelaria" in patch, false);
    assert.equal(
      "arancelPct" in
        pickImportacionLoteFields({ arancelPct: 30, impuestoLujoPct: 10 } as never),
      true
    );
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

  it("al cambiar el nº de BL lo pisa en cada expediente del lote", () => {
    const merged = mergeImportacionLote(
      { numeroBl: "321", puerto: "El Guamache", planillaFase: 2 },
      { numeroBl: "COSU999" }
    );
    assert.equal(merged.numeroBl, "COSU999");
    assert.equal(merged.puerto, "El Guamache");
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

  it("docs de la carga cubren registro, embarque, llegada y desaduanamiento del BL", () => {
    assert.deepEqual([...DOCUMENTO_TIPOS_CARGA_REGISTRO], [
      "factura_comercial",
      "certificado_origen",
    ]);
    assert.deepEqual([...DOCUMENTO_TIPOS_CARGA_BL_EMBARQUE], [
      "bl_guia",
      "lista_empaque",
      "poliza_transporte",
      "acta_recepcion_mercancia",
      "constancia_edi_reconocimiento",
    ]);
    assert.ok(DOCUMENTO_TIPOS_CARGA_BL_DESADUANA.includes("nacionalizacion"));
    assert.ok(DOCUMENTO_TIPOS_CARGA_BL_DESADUANA.includes("dav"));
    assert.ok(DOCUMENTO_TIPOS_CARGA_BL_DESADUANA.includes("pase_salida_levante"));
    assert.equal(DOCUMENTO_TIPOS_CARGA_BL.length, 17);
    assert.ok(DOCUMENTO_TIPOS_CARGA_BL.includes("factura_comercial"));
    assert.ok(DOCUMENTO_TIPOS_CARGA_BL.includes("certificado_origen"));
    assert.equal(isDocumentoLote("poliza_transporte"), true);
    assert.equal(isDocumentoLote("pase_salida_levante"), true);
    assert.equal(isDocumentoLote("poliza_seguro"), false);
    assert.equal(isDocumentoLote("foto_frontal"), false);
  });

  it("ruta del cargador va por BL, o from si aún no hay número", () => {
    assert.equal(cargaBlPath(" cosu 123 "), "/smartimport/lote?bl=COSU123");
    assert.equal(
      cargaBlPath(null, "abc-uuid"),
      "/smartimport/lote?from=abc-uuid"
    );
    assert.equal(cargaBlPath(null), "/smartimport/lote");
  });

  it("OCR no pisa un nº BL ya escrito", () => {
    assert.equal(numeroBlFromScan("321", "COSU999"), undefined);
    assert.equal(numeroBlFromScan("", "COSU999"), "COSU999");
    assert.equal(numeroBlFromScan(null, "  "), undefined);
  });

  it("une papeles de carga repartidos entre expedientes", () => {
    const merged = mergeDocumentosCargaBl([
      { lista_empaque: { url: "https://x/l.pdf", path: "l" } },
      { bl_guia: { url: "https://x/bl.pdf", path: "bl" } },
    ]);
    assert.equal(merged.lista_empaque?.path, "l");
    assert.equal(merged.bl_guia?.path, "bl");
    assert.equal(countDocumentosCargaBl(merged), 2);
  });

  it("hereda huecos de lote y no pisa fecha ni fase ya escritas", () => {
    const filled = fillEmptyImportacionLote(
      {
        numeroBl: "COSU123",
        planillaFase: 1,
        fechaIngreso: null,
        puerto: "La Guaira",
      },
      {
        numeroBl: "COSU123",
        fechaIngreso: "2026-08-01",
        puerto: "Guanta",
        planillaFase: 4,
        aduana: "Guanta",
      }
    );
    assert.equal(filled.fechaIngreso, "2026-08-01");
    assert.equal(filled.puerto, "La Guaira");
    assert.equal(filled.aduana, "Guanta");
    assert.equal(filled.planillaFase, 1);
  });

  it("al heredar docs no pisa certificado ni factura ya cargados", () => {
    const next = pickDocumentosLoteFaltantes(
      {
        factura_comercial: { url: "https://x/mia.pdf", path: "mia" },
        certificado_origen: { url: "https://x/c.pdf", path: "c" },
      },
      {
        factura_comercial: { url: "https://x/lote.pdf", path: "lote" },
        lista_empaque: { url: "https://x/l.pdf", path: "l" },
        certificado_origen: { url: "https://x/otro.pdf", path: "otro" },
      }
    );
    assert.equal(next.factura_comercial?.path, "mia");
    assert.equal(next.lista_empaque?.path, "l");
    assert.equal(next.certificado_origen?.path, "c");
  });

  it("si el expediente no tiene certificado, lo hereda de la carga", () => {
    const next = pickDocumentosLoteFaltantes(
      { factura_comercial: { url: "https://x/mia.pdf", path: "mia" } },
      {
        factura_comercial: { url: "https://x/lote.pdf", path: "lote" },
        certificado_origen: { url: "https://x/c.pdf", path: "c" },
      }
    );
    assert.equal(next.factura_comercial?.path, "mia");
    assert.equal(next.certificado_origen?.path, "c");
  });

  it("agrupa embarque por BL y deja sin número aparte", () => {
    const groups = groupByCargaBl([
      { id: "1", numeroBl: "COSU 123" },
      { id: "2", numeroBl: "cosu123" },
      { id: "3", numeroBl: null },
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.blKey, "COSU123");
    assert.equal(groups[0]?.items.length, 2);
    assert.equal(groups[1]?.blKey, "");
    assert.equal(countDocumentosCargaBl({ bl_guia: { url: "u", path: "p" } }), 1);
  });
});

function sameBl(a: string, b: string) {
  return normalizeLoteBlKey(a) === normalizeLoteBlKey(b);
}
