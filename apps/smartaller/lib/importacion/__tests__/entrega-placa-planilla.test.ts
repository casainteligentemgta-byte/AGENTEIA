import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esEntregaPlacaCompleta } from "../entrega-placa-planilla";

describe("esEntregaPlacaCompleta", () => {
  it("pide foto de placa y título", () => {
    assert.equal(esEntregaPlacaCompleta({}), false);
    assert.equal(
      esEntregaPlacaCompleta({
        foto_placa: { url: "https://x/placa.jpg", path: "placa.jpg" },
      }),
      false
    );
    assert.equal(
      esEntregaPlacaCompleta({
        foto_placa: { url: "https://x/placa.jpg", path: "placa.jpg" },
        titulo: { url: "https://x/titulo.pdf", path: "titulo.pdf" },
      }),
      true
    );
  });
});
