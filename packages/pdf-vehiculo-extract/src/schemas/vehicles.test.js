import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeValidationStatus,
  parsePdfExtractResult,
  safeParsePdfExtractResult,
} from "./vehicles.js";
import { reinforceVinValidation } from "../agents/pdf-vehiculo-extract.js";

describe("vehicles schema", () => {
  it("acepta el contrato success con un vehículo", () => {
    const data = parsePdfExtractResult({
      status: "success",
      vehicles: [
        {
          vin: "LVVDB21B8PD123456",
          marca: "CHERY",
          modelo: "Tiggo 2 Pro",
          año: 2024,
          color: "Blanco",
          numeroMotor: "ABC123",
          numeroPlaca: null,
          precio: 12500,
          validationStatus: "verde",
        },
      ],
      certificados: [
        {
          vin: "LVVDB21B8PD123456",
          paisOrigen: "China",
          fechaEmision: "2024-06-01",
          autoridadEmisora: "CCIC",
          tipoCertificado: "origen",
          numerocertificado: "COO-001",
          estado: "vigente",
        },
      ],
      errores: [],
    });
    assert.equal(data.vehicles.length, 1);
    assert.equal(data.certificados[0].numerocertificado, "COO-001");
  });

  it("rechaza status inválido", () => {
    const r = safeParsePdfExtractResult({
      status: "ok",
      vehicles: [],
      certificados: [],
      errores: [],
    });
    assert.equal(r.success, false);
  });

  it("computeValidationStatus: rojo sin marca", () => {
    assert.equal(
      computeValidationStatus({
        vin: "LVVDB21B8PD123456",
        marca: "",
        modelo: "X",
        color: "Rojo",
        numeroMotor: "M1",
        año: 2024,
      }),
      "rojo"
    );
  });

  it("reinforceVinValidation marca rojo si falta cert", () => {
    const out = reinforceVinValidation({
      status: "success",
      vehicles: [
        {
          vin: "LVVDB21B8PD123456",
          marca: "CHERY",
          modelo: "Tiggo",
          año: 2024,
          color: "Blanco",
          numeroMotor: "M1",
          numeroPlaca: null,
          precio: null,
          validationStatus: "verde",
        },
      ],
      certificados: [
        {
          vin: "LVVDB21B8PD999999",
          paisOrigen: "China",
          fechaEmision: null,
          numerocertificado: "C1",
          estado: null,
        },
      ],
      errores: [],
    });
    assert.equal(out.vehicles[0].validationStatus, "rojo");
    assert.ok(out.errores.length >= 1);
  });
});
