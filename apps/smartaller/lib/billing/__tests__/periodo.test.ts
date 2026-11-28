import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularPeriodoRenovacion,
  diasRestantesVencimiento,
  suscripcionEstaVigente,
  vencimientoCerca,
} from "../periodo";
import { vesDelPlan, formatUsd } from "../plans";
import { PAGO_MOVIL } from "../pago-movil";

describe("calcularPeriodoRenovacion", () => {
  it("parte de ahora si no hay vencimiento", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    const { inicio, fin } = calcularPeriodoRenovacion(null, now, 30);
    assert.equal(inicio.toISOString(), now.toISOString());
    assert.equal(fin.toISOString(), "2026-12-28T12:00:00.000Z");
  });

  it("extiende desde el vencimiento si aún es válido", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    const actual = new Date("2026-12-10T12:00:00.000Z");
    const { fin } = calcularPeriodoRenovacion(actual, now, 30);
    assert.equal(fin.toISOString(), "2027-01-09T12:00:00.000Z");
  });

  it("reinicia desde ahora si ya venció", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    const actual = new Date("2026-11-01T12:00:00.000Z");
    const { inicio, fin } = calcularPeriodoRenovacion(actual, now, 30);
    assert.equal(inicio.toISOString(), now.toISOString());
    assert.equal(fin.toISOString(), "2026-12-28T12:00:00.000Z");
  });
});

describe("suscripcionEstaVigente", () => {
  it("exige activa y fecha futura", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    assert.equal(suscripcionEstaVigente(false, "2027-01-01T00:00:00.000Z", now), false);
    assert.equal(suscripcionEstaVigente(true, null, now), true);
    assert.equal(suscripcionEstaVigente(true, "2026-11-27T12:00:00.000Z", now), false);
    assert.equal(suscripcionEstaVigente(true, "2026-11-29T12:00:00.000Z", now), true);
  });
});

describe("avisos de vencimiento", () => {
  it("detecta cercanía a 7 días", () => {
    const now = new Date("2026-11-28T12:00:00.000Z");
    const inFive = new Date("2026-12-03T12:00:00.000Z").toISOString();
    assert.equal(vencimientoCerca(inFive, now, 7), true);
    assert.equal(diasRestantesVencimiento(inFive, now), 5);
  });
});

describe("precios y Pago Móvil", () => {
  it("convierte a bolívares con la tasa", () => {
    assert.equal(vesDelPlan(2.99, 40), 119.6);
    assert.equal(vesDelPlan(100, 40), 4000);
    assert.match(formatUsd(2.99), /2[,.]99/);
  });

  it("muestra Banesco y los datos fijos", () => {
    assert.equal(PAGO_MOVIL.banco, "Banesco");
    assert.equal(PAGO_MOVIL.telefono, "0414-7937270");
    assert.equal(PAGO_MOVIL.cedula, "V-13.848.186");
  });
});
