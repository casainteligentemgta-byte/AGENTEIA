import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARANCEL_PCT_DEFAULT,
  LUJO_CIF_UMBRAL_USD,
  TASA_SENIAT_PCT,
  IVA_PCT,
  aplicaImpuestoLujo,
  formatUsd,
  multiplicarPrecalculo,
  parseMoneyInput,
  precalcularAranceles,
  resumenLotePrecalculo,
  sumarPrecalculos,
} from "../precalculo-aranceles";

describe("precálculo de aranceles e impuestos", () => {
  it("reproduce el ejemplo CIF USD 25,000 al 30%", () => {
    const calc = precalcularAranceles({
      valorCif: 25_000,
      arancelPct: 30,
    });
    assert.ok(calc);
    assert.equal(calc.valorCif, 25_000);
    assert.equal(calc.arancelPct, ARANCEL_PCT_DEFAULT);
    assert.equal(calc.tasaSeniatPct, TASA_SENIAT_PCT);
    assert.equal(calc.ivaPct, IVA_PCT);
    assert.equal(calc.arancelUsd, 7_500);
    assert.equal(calc.tasaSeniatUsd, 250);
    assert.equal(calc.subtotalGravableUsd, 32_750);
    assert.equal(calc.ivaUsd, 5_240);
    assert.equal(calc.totalSinLujoUsd, 37_990);
    assert.equal(calc.lujoAplica, false);
    assert.equal(calc.impuestoLujoUsd, 0);
    assert.equal(calc.totalUsd, 37_990);
  });

  it("no cobra lujo si CIF es exactamente 30,000", () => {
    const calc = precalcularAranceles({ valorCif: LUJO_CIF_UMBRAL_USD });
    assert.ok(calc);
    assert.equal(calc.lujoAplica, false);
    assert.equal(calc.impuestoLujoUsd, 0);
  });

  it("cobra lujo 10% sobre CIF si supera USD 30,000", () => {
    const calc = precalcularAranceles({
      valorCif: 35_000,
      arancelPct: 30,
      impuestoLujoPct: 10,
    });
    assert.ok(calc);
    assert.equal(calc.lujoAplica, true);
    assert.equal(calc.impuestoLujoUsd, 3_500);
    assert.equal(calc.arancelUsd, 10_500);
    assert.equal(calc.tasaSeniatUsd, 350);
    assert.equal(calc.subtotalGravableUsd, 45_850);
    assert.equal(calc.ivaUsd, 7_336);
    assert.equal(calc.totalSinLujoUsd, 53_186);
    assert.equal(calc.totalUsd, 56_686);
  });

  it("convierte a bolívares con la tasa oficial del día", () => {
    const calc = precalcularAranceles({
      valorCif: 25_000,
      arancelPct: 30,
      tasaBs: 40,
    });
    assert.ok(calc);
    assert.equal(calc.totalUsd, 37_990);
    assert.equal(calc.totalBs, 1_519_600);
    assert.equal(calc.arancelBs, 300_000);
  });

  it("por 5 vehículos con el mismo CIF multiplica el total", () => {
    const uno = precalcularAranceles({ valorCif: 25_000, arancelPct: 30 });
    assert.ok(uno);
    const lote = multiplicarPrecalculo(uno, 5);
    assert.ok(lote);
    assert.equal(lote.valorCif, 125_000);
    assert.equal(lote.totalUsd, 189_950);
    assert.equal(resumenLotePrecalculo(lote, 5), "5 vehículos · precálculo $189,950");
  });

  it("suma CIFs distintos del mismo BL", () => {
    const lote = sumarPrecalculos([
      { valorCif: 25_000, arancelPct: 30 },
      { valorCif: 35_000, arancelPct: 30, impuestoLujoPct: 10 },
    ]);
    assert.ok(lote);
    assert.equal(lote.valorCif, 60_000);
    assert.equal(lote.totalUsd, 37_990 + 56_686);
    assert.equal(lote.lujoAplica, true);
  });

  it("devuelve null sin CIF y parsea montos con coma", () => {
    assert.equal(precalcularAranceles({ valorCif: null }), null);
    assert.equal(aplicaImpuestoLujo(25_000), false);
    assert.equal(parseMoneyInput("25000"), 25_000);
    assert.equal(parseMoneyInput("25,000.50"), 25_000.5);
    assert.equal(parseMoneyInput("$7,500"), 7_500);
    assert.equal(formatUsd(25_000), "$25,000");
  });
});
