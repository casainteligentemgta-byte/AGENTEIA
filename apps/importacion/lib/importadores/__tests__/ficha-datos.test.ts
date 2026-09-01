import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { importadorFichaDatos } from "../ficha-datos";

describe("importadorFichaDatos", () => {
  it("persona natural muestra nombre, RIF y cédula", () => {
    const rows = importadorFichaDatos({
      tipo: "natural",
      nombre: "Luis Mata",
      documento: "V-13848186-3",
      cedula: "V-13848186",
      telefono: "04141234567",
      email: "luis@example.com",
      direccion: "Porlamar",
      instagram: null,
      denominacionComercial: null,
      razonSocial: null,
      repLegalNombre: null,
      repLegalCedula: null,
      repLegalEmail: null,
      repLegalTelefono: null,
      empresaTelefono: null,
      empresaEmail: null,
      empresaDomicilio: null,
      registroPuertoLibre: null,
      registroPlVence: null,
    });
    const labels = rows.map((r) => r.label);
    assert.ok(labels.includes("Nombre"));
    assert.ok(labels.includes("RIF"));
    assert.ok(labels.includes("Cédula"));
    assert.equal(rows.find((r) => r.label === "Cédula")?.value, "V-13.848.186");
    assert.equal(labels.includes("Razón social"), false);
  });

  it("persona jurídica muestra RIF, registro PL y cédula del representante", () => {
    const rows = importadorFichaDatos({
      tipo: "juridica",
      nombre: "Smart Taller",
      documento: "J-12345678-9",
      cedula: "V-11111111",
      telefono: null,
      email: null,
      direccion: null,
      instagram: null,
      denominacionComercial: "Smart Taller",
      razonSocial: "Smart Taller C.A.",
      repLegalNombre: "Ana Pérez",
      repLegalCedula: "V-11111111",
      repLegalEmail: null,
      repLegalTelefono: null,
      empresaTelefono: "02951234567",
      empresaEmail: "info@example.com",
      empresaDomicilio: "La Asunción",
      registroPuertoLibre: "PL-99",
      registroPlVence: "2027-01-01",
    });
    const labels = rows.map((r) => r.label);
    assert.ok(labels.includes("RIF"));
    assert.ok(labels.includes("Registro Puerto Libre"));
    assert.ok(labels.includes("Cédula del representante"));
    assert.equal(labels.includes("Instagram"), false);
  });
});
