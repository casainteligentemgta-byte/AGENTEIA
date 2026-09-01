import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
    assert.deepEqual(added, ["cedula_importador", "rif_importador"]);
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
});
