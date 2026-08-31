import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accionesRegistroDashboard,
  registroDatosCompletos,
} from "../dashboard-registro-acciones";

describe("accionesRegistroDashboard", () => {
  it("con datos verdes no muestra Completar: Registrar + Embarque", () => {
    assert.equal(registroDatosCompletos({ completitudDatos: "verde" }), true);
    const acciones = accionesRegistroDashboard({
      vehiculoId: "abc",
      completitudDatos: "verde",
    });
    assert.deepEqual(
      acciones.map((a) => a.label),
      ["Registrar", "Embarque"]
    );
    assert.equal(acciones[0]?.tone, "green");
    assert.equal(acciones[1]?.tone, "red");
    assert.ok(!acciones.some((a) => a.label === "Completar"));
  });

  it("sin semáforo, marca+modelo+color cuentan como listos", () => {
    const acciones = accionesRegistroDashboard({
      vehiculoId: "abc",
      marca: "Chery",
      modelo: "Arrizo 5 Pro",
      color: "NASDAQ SILVER",
    });
    assert.deepEqual(
      acciones.map((a) => a.label),
      ["Registrar", "Embarque"]
    );
  });

  it("si faltan datos sigue Completar", () => {
    const acciones = accionesRegistroDashboard({
      vehiculoId: "abc",
      completitudDatos: "rojo",
    });
    assert.equal(acciones[0]?.label, "Completar");
    assert.equal(acciones[0]?.tone, "red");
  });
});
