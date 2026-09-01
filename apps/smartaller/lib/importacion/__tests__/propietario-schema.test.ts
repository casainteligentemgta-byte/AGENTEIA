import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { propietarioUpsertSchema } from "@/lib/schemas/propietario";

describe("propietarioUpsertSchema", () => {
  it("exige nombre y acepta ficha sin email", () => {
    const parsed = propietarioUpsertSchema.safeParse({
      nombre: "Ana Pérez",
      cedula: "v12345678",
      email: "",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.nombre, "Ana Pérez");
    assert.equal(parsed.data.cedula, "V-12345678");
    assert.equal(parsed.data.email, null);
  });

  it("rechaza sin nombre", () => {
    const parsed = propietarioUpsertSchema.safeParse({ nombre: "  " });
    assert.equal(parsed.success, false);
  });
});
