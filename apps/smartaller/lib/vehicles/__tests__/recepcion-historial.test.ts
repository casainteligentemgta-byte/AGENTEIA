import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RECEPCION_HISTORIAL_LABEL,
  etiquetaHistorialMantenimiento,
  isRecepcionMantenimiento,
} from "../recepcion-historial";

describe("recepcion-historial", () => {
  it("detecta actas de recepción por tipo y por texto legado", () => {
    assert.equal(
      isRecepcionMantenimiento({
        descripcion: "Cambio de aceite",
        detalle_revision: { tipo: "orden_recepcion" },
      }),
      true
    );
    assert.equal(
      isRecepcionMantenimiento({
        descripcion: "Acta de recepción — ingreso al taller",
        detalle_revision: null,
      }),
      true
    );
    assert.equal(
      isRecepcionMantenimiento({
        descripcion: "Cambio de aceite",
        detalle_revision: { tipo: "mantenimiento" },
      }),
      false
    );
    assert.equal(
      isRecepcionMantenimiento({
        descripcion: "Recepción / inspección",
        detalle_revision: null,
      }),
      true
    );
  });

  it("etiqueta la visita de ingreso sin usarla como servicio", () => {
    assert.equal(
      etiquetaHistorialMantenimiento({
        descripcion: "Acta de recepción — ingreso al taller",
        detalle_revision: { tipo: "orden_recepcion" },
      }),
      RECEPCION_HISTORIAL_LABEL
    );
    assert.equal(
      etiquetaHistorialMantenimiento({ descripcion: "Balanceo", detalle_revision: null }),
      "Balanceo"
    );
  });
});
