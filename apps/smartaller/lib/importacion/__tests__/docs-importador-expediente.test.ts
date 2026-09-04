import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  embarqueDocumentosObligatorios,
  embarqueImportadorTipos,
} from "../../schemas/vehiculo-documentos";
import { mergeCedulaRifDesdeCliente } from "../docs-importador-expediente";

const cedula = {
  url: "https://cdn.example/cedula.jpg",
  path: "t/imp/cedula.jpg",
  scanned_at: "2026-09-01T00:00:00.000Z",
  file_name: "cedula.jpg",
};
const rif = {
  url: "https://cdn.example/rif.pdf",
  path: "t/imp/rif.pdf",
  scanned_at: "2026-09-01T00:00:00.000Z",
  file_name: "rif.pdf",
};

describe("mergeCedulaRifDesdeCliente", () => {
  it("copia cédula y RIF del cliente si el expediente no los tiene", () => {
    const { next, added } = mergeCedulaRifDesdeCliente(
      {},
      { cedula, rif }
    );
    assert.deepEqual(added, ["rif_importador", "cedula_importador"]);
    assert.equal(next.cedula_importador?.url, cedula.url);
    assert.equal(next.rif_importador?.url, rif.url);
  });

  it("no pisa un archivo ya cargado en el expediente", () => {
    const ya = {
      url: "https://cdn.example/otra.pdf",
      path: "t/v/otra.pdf",
      scanned_at: "2026-08-01T00:00:00.000Z",
      file_name: "otra.pdf",
    };
    const { next, added } = mergeCedulaRifDesdeCliente(
      { cedula_importador: ya },
      { cedula, rif }
    );
    assert.deepEqual(added, ["rif_importador"]);
    assert.equal(next.cedula_importador?.url, ya.url);
    assert.equal(next.rif_importador?.url, rif.url);
  });

  it("no agrega nada si el cliente no tiene archivos", () => {
    const { added } = mergeCedulaRifDesdeCliente({}, {});
    assert.deepEqual(added, []);
  });

  it("también hereda domicilio, inscripción y acta si el expediente no los tiene", () => {
    const extra = {
      url: "https://cdn.example/acta.pdf",
      path: "t/imp/acta.pdf",
      scanned_at: "2026-09-01T00:00:00.000Z",
      file_name: "acta.pdf",
    };
    const { next, added } = mergeCedulaRifDesdeCliente(
      {},
      {
        constancia_domicilio: extra,
        comprobante_inscripcion_tributaria: extra,
        acta_constitutiva: extra,
      }
    );
    assert.deepEqual(added, [
      "acta_constitutiva",
      "constancia_domicilio",
      "comprobante_inscripcion_tributaria",
    ]);
    assert.equal(next.acta_constitutiva?.url, extra.url);
  });
});

describe("embarque docs del importador", () => {
  it("acta solo si es jurídica; BL y lista siguen obligatorios", () => {
    assert.deepEqual(embarqueImportadorTipos(false), [
      "rif_importador",
      "cedula_importador",
      "constancia_domicilio",
      "comprobante_inscripcion_tributaria",
    ]);
    assert.ok(embarqueImportadorTipos(true).includes("acta_constitutiva"));
    const nat = embarqueDocumentosObligatorios(false);
    assert.ok(nat.includes("bl_guia"));
    assert.ok(nat.includes("lista_empaque"));
    assert.equal(nat.includes("poliza_transporte"), false);
    assert.equal(nat.includes("acta_constitutiva"), false);
  });
});
