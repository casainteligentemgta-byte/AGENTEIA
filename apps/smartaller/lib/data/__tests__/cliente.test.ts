import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENTE_ERROR_GENERICO,
  clienteBusquedaSchema,
  proyectarHistorialCliente,
  telefonoUltimos4Igual,
} from "../cliente-lookup";

describe("clienteBusquedaSchema", () => {
  it("exige placa y los últimos 4 dígitos", () => {
    const ok = clienteBusquedaSchema.safeParse({
      placa: "abc 123",
      telefonoUltimos4: "7890",
    });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.placa, "ABC123");
      assert.equal(ok.data.telefonoUltimos4, "7890");
    }
  });

  it("rechaza búsqueda solo con placa", () => {
    const parsed = clienteBusquedaSchema.safeParse({ placa: "ABC123" });
    assert.equal(parsed.success, false);
  });

  it("rechaza teléfono que no sean 4 dígitos", () => {
    const parsed = clienteBusquedaSchema.safeParse({
      placa: "ABC123",
      telefonoUltimos4: "12",
    });
    assert.equal(parsed.success, false);
  });

  it("ignora comodines en la placa", () => {
    const parsed = clienteBusquedaSchema.safeParse({
      placa: "AB%12_",
      telefonoUltimos4: "1234",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.placa, "AB12");
    }
  });
});

describe("telefonoUltimos4Igual", () => {
  it("acepta el sufijo correcto con formato sucio", () => {
    assert.equal(telefonoUltimos4Igual("+58 414-123-7890", "7890"), true);
    assert.equal(telefonoUltimos4Igual("04141237890", "7890"), true);
  });

  it("rechaza sufijo incorrecto, teléfono corto o ausente", () => {
    assert.equal(telefonoUltimos4Igual("+58 414-123-7890", "0000"), false);
    assert.equal(telefonoUltimos4Igual("123", "0123"), false);
    assert.equal(telefonoUltimos4Igual(null, "1234"), false);
    assert.equal(telefonoUltimos4Igual("", "1234"), false);
  });
});

describe("proyectarHistorialCliente", () => {
  it("no incluye teléfono, documentos ni ficha privada", () => {
    const publicData = proyectarHistorialCliente(
      {
        id: "veh-1",
        placa: "ABC123",
        nombre_cliente: "Ana",
        telefono_cliente: "04141234567",
        kilometraje_ultimo: 1000,
        marca: "Toyota",
        modelo: "Hilux",
        color: "Blanco",
      },
      [
        {
          id: "m1",
          created_at: "2026-01-01T00:00:00.000Z",
          descripcion: "Aceite",
          costo: 50,
          kilometraje: 900,
        },
      ],
      [{ id: "r1", fecha_programada: "2026-06-01", kilometraje_objetivo: 5000 }]
    );

    assert.equal(publicData.placa, "ABC123");
    assert.equal(publicData.nombre_cliente, "Ana");
    assert.equal("telefono_cliente" in publicData, false);
    assert.equal("documentos" in publicData, false);
    assert.equal("recepcion_inicial" in publicData, false);
    assert.equal("cedula_propietario" in publicData, false);
    assert.deepEqual(Object.keys(publicData.mantenimientos[0] ?? {}).sort(), [
      "costo",
      "created_at",
      "descripcion",
      "id",
      "kilometraje",
    ]);
    assert.equal(CLIENTE_ERROR_GENERICO.includes("teléfono ingresado"), false);
    assert.equal(CLIENTE_ERROR_GENERICO.includes("varios registros"), false);
  });
});
