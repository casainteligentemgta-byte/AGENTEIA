import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esRegistroPlanillaCompleto } from "../registro-planilla";

const completo = {
  marca: "Chery",
  modelo: "Tiggo",
  color: "Blanco",
  anio: 2024,
  serialMotor: "MOT123",
  vin: "LVVDB21B6ND123456",
  serialCarroceria: "LVVDB21B6ND123456",
  kilometraje: 0,
  condicionVehiculo: "nuevo" as const,
  esSubasta: false,
  importadorNombre: "Casa Import",
  tieneFactura: true,
  tieneCertificado: true,
};

describe("esRegistroPlanillaCompleto", () => {
  it("el chip Registro queda verde si están todos los campos y docs", () => {
    assert.equal(esRegistroPlanillaCompleto(completo), true);
  });

  it("sin factura o certificado no está completo", () => {
    assert.equal(
      esRegistroPlanillaCompleto({ ...completo, tieneFactura: false }),
      false
    );
    assert.equal(
      esRegistroPlanillaCompleto({ ...completo, tieneCertificado: false }),
      false
    );
  });

  it("POR-COMPLETAR no cuenta como dato de registro", () => {
    assert.equal(
      esRegistroPlanillaCompleto({ ...completo, marca: "POR-COMPLETAR" }),
      false
    );
  });
});
