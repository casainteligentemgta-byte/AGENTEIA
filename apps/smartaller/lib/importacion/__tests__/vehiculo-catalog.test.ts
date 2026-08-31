import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VEHICULO_COLORES,
  sugerenciasColorCargaMasiva,
} from "../vehiculo-catalog";

describe("sugerenciasColorCargaMasiva", () => {
  it("pone primero los colores del lote y luego el catálogo", () => {
    const next = sugerenciasColorCargaMasiva([
      "NASDAQ SILVER",
      "phantom gray",
      "Blanco",
    ]);
    assert.equal(next[0], "NASDAQ SILVER");
    assert.equal(next[1], "phantom gray");
    assert.ok(next.includes("Negro"));
    assert.equal(next.filter((c) => c.toLowerCase() === "blanco").length, 1);
  });

  it("permite un color escrito que no está en el catálogo", () => {
    const next = sugerenciasColorCargaMasiva(["KHAKI WHITE"]);
    assert.ok(next.includes("KHAKI WHITE"));
    assert.ok(VEHICULO_COLORES.every((c) => next.includes(c)));
  });

  it("ignora vacíos y duplicados", () => {
    const next = sugerenciasColorCargaMasiva(["  ", "Gris", "gris"]);
    assert.equal(next.filter((c) => c.toLowerCase() === "gris").length, 1);
    assert.ok(!next.some((c) => !c.trim()));
  });
});
