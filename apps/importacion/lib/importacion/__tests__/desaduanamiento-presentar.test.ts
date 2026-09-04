import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
  PL_DESADUANAMIENTO_PRECARGA_TIPOS,
  PL_DESADUANAMIENTO_PRESENTAR_TIPOS,
} from "../../schemas/vehiculo-documentos";
import { docsDesaduanamientoPdfPorRegimen } from "../regimenes";

describe("expediente a presentar en desaduanamiento", () => {
  it("abre con factura, certificado, BL, lista, póliza, cédula, RIF y DUA", () => {
    assert.deepEqual([...PL_DESADUANAMIENTO_PRESENTAR_TIPOS], [
      "factura_comercial",
      "certificado_origen",
      "bl_guia",
      "lista_empaque",
      "poliza_transporte",
      "cedula_importador",
      "rif_importador",
      "nacionalizacion",
    ]);
  });

  it("el PDF SENIAT lleva primero esos papeles y no el pase de salida", () => {
    const pdf = docsDesaduanamientoPdfPorRegimen(
      "puerto_libre",
      PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
      { esJuridica: false }
    );
    assert.deepEqual(pdf.slice(0, 8), [...PL_DESADUANAMIENTO_PRESENTAR_TIPOS]);
    assert.equal(pdf.includes("pase_salida_levante"), false);
    assert.ok(pdf.includes("dav"));
  });

  it("factura, BL y póliza se consideran precarga; el DUA no", () => {
    assert.ok(PL_DESADUANAMIENTO_PRECARGA_TIPOS.includes("factura_comercial"));
    assert.ok(PL_DESADUANAMIENTO_PRECARGA_TIPOS.includes("bl_guia"));
    assert.ok(PL_DESADUANAMIENTO_PRECARGA_TIPOS.includes("poliza_transporte"));
    assert.equal(
      (PL_DESADUANAMIENTO_PRECARGA_TIPOS as readonly string[]).includes(
        "nacionalizacion"
      ),
      false
    );
  });

  it("ordinario agrega licencia de importación al expediente", () => {
    const pdf = docsDesaduanamientoPdfPorRegimen(
      "ordinario",
      PL_DESADUANAMIENTO_DOCUMENTO_TIPOS,
      { esJuridica: false }
    );
    assert.ok(pdf.includes("licencia_importacion_automotriz"));
  });
});
