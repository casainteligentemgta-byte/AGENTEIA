import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vehiculoPatchFromPropietario } from "../propietario-asignacion";
import { parseImportacion } from "@/lib/schemas/vehiculo-documentos";

describe("vehiculoPatchFromPropietario", () => {
  it("copia la ficha al expediente y no avanza la fase", () => {
    const patch = vehiculoPatchFromPropietario(
      "11111111-1111-1111-1111-111111111111",
      {
        nombre: "Ana Pérez",
        cedula: "V-12345678",
        telefono: "04141234567",
        email: "ana@test.com",
        fechaNacimiento: "1990-05-01",
        direccion: "Calle 1",
      },
      { planillaFase: 5, codigoExpediente: "PL-2026.9.1" }
    );
    assert.equal(patch.nombre_cliente, "Ana Pérez");
    assert.equal(patch.cedula_propietario, "V-12345678");
    assert.equal(patch.telefono_cliente, "04141234567");
    assert.equal(patch.email_propietario, "ana@test.com");
    assert.equal(patch.fecha_nacimiento_propietario, "1990-05-01");
    const imp = parseImportacion(patch.importacion);
    assert.equal(imp.compradorDireccion, "Calle 1");
    assert.equal(imp.planillaFase, 5);
    assert.equal(imp.codigoExpediente, "PL-2026.9.1");
  });
});
