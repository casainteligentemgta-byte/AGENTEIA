import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OJO_MODULES } from "../nav";

describe("Ojo de Dios · navegación visual", () => {
  it("expone los módulos acordados sin inventar fuentes", () => {
    assert.deepEqual(
      OJO_MODULES.map((mod) => mod.id),
      ["clima", "agenda", "salud", "correo", "titulares", "tendencias", "cine"]
    );
    assert.equal(
      OJO_MODULES.every((mod) => mod.label.length > 0),
      true
    );
  });
});
