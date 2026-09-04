import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aplicarTasaOficialAlPago,
  debeActualizarTasaOficial,
  marcarPagoAranceles,
  snapshotPagoAranceles,
  sumarPagosBs,
  usdABsOficial,
} from "../pago-aranceles";
import { tasaOficialEsDeHoy, todayYmdCaracas } from "../tasa-bcv";

describe("pago de aranceles en bolívares", () => {
  it("convierte el total USD a Bs con la tasa oficial", () => {
    assert.equal(usdABsOficial(37_990, 40), 1_519_600);
    assert.equal(usdABsOficial(37_990, null), null);
  });

  it("reconoce el día civil de Caracas (no UTC)", () => {
    const nocheUtc = new Date("2026-09-05T01:30:00.000Z");
    assert.equal(todayYmdCaracas(nocheUtc), "2026-09-04");
    assert.equal(tasaOficialEsDeHoy("2026-09-04", "2026-09-04"), true);
    assert.equal(tasaOficialEsDeHoy("2026-09-03", "2026-09-04"), false);
  });

  it("pide actualizar si la tasa no es de hoy o falta el monto en Bs", () => {
    const base = {
      valorCif: 25_000,
      arancelPct: 30,
      tasaCambioBcv: 40,
      tasaOficialFecha: "2026-09-03",
      pagoArancelesEstado: "pendiente",
      pagoArancelesUsd: 37_990,
    };
    assert.equal(debeActualizarTasaOficial(base, "2026-09-04"), true);
    assert.equal(
      debeActualizarTasaOficial(
        { ...base, tasaOficialFecha: "2026-09-04", pagoArancelesBs: 1_519_600 },
        "2026-09-04"
      ),
      false
    );
    assert.equal(
      debeActualizarTasaOficial(
        { ...base, pagoArancelesEstado: "pagado", tasaOficialFecha: "2026-09-03" },
        "2026-09-04"
      ),
      false
    );
  });

  it("aplica la tasa del día y no pisa un pago ya registrado", () => {
    const lookup = {
      tasa: 42.5,
      fechaConsulta: "2026-09-04",
      fechaVigente: "2026-09-04",
      futura: false,
    };
    const updated = aplicarTasaOficialAlPago(
      {
        valorCif: 25_000,
        arancelPct: 30,
        pagoArancelesUsd: 37_990,
        pagoArancelesEstado: "pendiente",
      },
      lookup
    );
    assert.equal(updated.tasaCambioBcv, 42.5);
    assert.equal(updated.tasaOficialFecha, "2026-09-04");
    assert.equal(updated.pagoArancelesBs, 1_614_575);
    assert.equal(updated.tasaOficialFuente, "bcv");

    const frozen = aplicarTasaOficialAlPago(
      {
        pagoArancelesEstado: "pagado",
        pagoArancelesUsd: 37_990,
        pagoArancelesBs: 1_519_600,
        tasaCambioBcv: 40,
        tasaOficialFecha: "2026-09-01",
      },
      lookup
    );
    assert.equal(frozen.pagoArancelesBs, 1_519_600);
    assert.equal(frozen.tasaCambioBcv, 40);
  });

  it("al marcar pagado congela el monto en Bs", () => {
    const paid = marcarPagoAranceles(
      {
        pagoArancelesUsd: 37_990,
        tasaCambioBcv: 40,
        tasaOficialFecha: "2026-09-04",
      },
      "2026-09-04T12:00:00.000Z"
    );
    assert.equal(paid.pagoArancelesEstado, "pagado");
    assert.equal(paid.pagoArancelesBs, 1_519_600);
    assert.equal(paid.pagoArancelesPagadoAt, "2026-09-04T12:00:00.000Z");
  });

  it("suma el lote en Bs y cuenta pendientes", () => {
    const lote = sumarPagosBs([
      { pagoArancelesUsd: 37_990, tasaCambioBcv: 40, pagoArancelesEstado: "pendiente" },
      { pagoArancelesUsd: 37_990, tasaCambioBcv: 40, pagoArancelesEstado: "pagado" },
    ]);
    assert.equal(lote.totalUsd, 75_980);
    assert.equal(lote.totalBs, 3_039_200);
    assert.equal(lote.pendientes, 1);
    const snap = snapshotPagoAranceles({
      valorCif: 25_000,
      arancelPct: 30,
      tasaCambioBcv: 40,
    });
    assert.equal(snap.totalUsd, 37_990);
    assert.equal(snap.totalBs, 1_519_600);
  });
});
