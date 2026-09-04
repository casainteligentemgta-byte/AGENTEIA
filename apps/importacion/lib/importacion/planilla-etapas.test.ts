import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  esPlanillaCompleta,
  migratePlanillaFase,
  parsePlanillaFaseQuery,
  PLANILLA_FASE_COMPLETA,
} from "./planilla-etapas";

describe("migratePlanillaFase", () => {
  it("rev 2 no desplaza", () => {
    assert.equal(migratePlanillaFase(4, 2), 4);
    assert.equal(migratePlanillaFase(5, 2), 5);
    assert.equal(migratePlanillaFase(11, 2), 11);
  });

  it("rev 1: fases 1–4 iguales; 5+ suman 2", () => {
    assert.equal(migratePlanillaFase(1, 1), 1);
    assert.equal(migratePlanillaFase(4, 1), 4);
    assert.equal(migratePlanillaFase(5, 1), 7);
    assert.equal(migratePlanillaFase(6, 1), 8);
    assert.equal(migratePlanillaFase(7, 1), 9);
    assert.equal(migratePlanillaFase(8, 1), 10);
    assert.equal(migratePlanillaFase(9, 1), 11);
  });

  it("rev ausente se trata como 1", () => {
    assert.equal(migratePlanillaFase(5, undefined), 7);
  });
});

describe("parsePlanillaFaseQuery", () => {
  it("acepta 1–10 y alias de registro/embarque", () => {
    assert.equal(parsePlanillaFaseQuery("registro"), 1);
    assert.equal(parsePlanillaFaseQuery("1a"), 2);
    assert.equal(parsePlanillaFaseQuery("5"), 5);
    assert.equal(parsePlanillaFaseQuery("10"), 10);
    assert.equal(parsePlanillaFaseQuery("11"), undefined);
    assert.equal(parsePlanillaFaseQuery(undefined), undefined);
  });
});

describe("esPlanillaCompleta", () => {
  it("completa desde fase 11", () => {
    assert.equal(esPlanillaCompleta(10), false);
    assert.equal(esPlanillaCompleta(PLANILLA_FASE_COMPLETA), true);
  });
});
