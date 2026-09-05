import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENTREGA_PLACA_TIPOS,
  docsEntregaPlacaListos,
  esEntregaPlacaCompleta,
  validarPlacaVehicular,
} from "../entrega-placa-planilla";

const pdf = (path: string) => ({
  url: `https://example.com/${path}`,
  path,
});

const docsCompletos = {
  documento_circulacion: pdf("circulacion.pdf"),
  placa_pdf: pdf("placa.pdf"),
  titulo: pdf("titulo.pdf"),
  rcv_seguro: pdf("rcv.pdf"),
  tarjeta_circulacion: pdf("tarjeta.pdf"),
};

describe("entrega de placa tras INTT", () => {
  it("exige circulación, PDF de placa, título, RCV y tarjeta", () => {
    assert.deepEqual([...ENTREGA_PLACA_TIPOS], [
      "documento_circulacion",
      "placa_pdf",
      "titulo",
      "rcv_seguro",
      "tarjeta_circulacion",
    ]);
    assert.equal(docsEntregaPlacaListos({}), false);
    assert.equal(
      docsEntregaPlacaListos({
        documento_circulacion: pdf("circulacion.pdf"),
        rcv_seguro: pdf("rcv.pdf"),
        tarjeta_circulacion: pdf("tarjeta.pdf"),
      }),
      false
    );
    assert.equal(docsEntregaPlacaListos(docsCompletos), true);
  });

  it("no está completa sin placa real", () => {
    assert.equal(esEntregaPlacaCompleta(docsCompletos), false);
    assert.equal(esEntregaPlacaCompleta(docsCompletos, "", "PL-2026.9.1"), false);
    assert.equal(
      esEntregaPlacaCompleta(docsCompletos, "PL-2026.9.1", "PL-2026.9.1"),
      false
    );
    assert.equal(
      esEntregaPlacaCompleta(docsCompletos, "NP-2026.9.1", "PL-2026.9.1"),
      false
    );
    assert.equal(
      esEntregaPlacaCompleta(docsCompletos, "AB123CD", "PL-2026.9.1"),
      true
    );
  });

  it("valida placa única y rechaza el código de expediente", () => {
    assert.equal(validarPlacaVehicular("").ok, false);
    assert.equal(validarPlacaVehicular("PL-2026.9.1").ok, false);
    assert.equal(validarPlacaVehicular("NP-2026.9.1", "PL-2026.9.1").ok, false);
    const ok = validarPlacaVehicular("ab 123cd", "PL-2026.9.1");
    assert.deepEqual(ok, { ok: true, placa: "AB123CD" });
  });
});
