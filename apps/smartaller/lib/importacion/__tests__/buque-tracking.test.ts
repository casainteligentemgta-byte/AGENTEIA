import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  badgeContadorLlegada,
  detectarNaviera,
  diasHastaLlegadaBuque,
  etiquetaLlegadaBuque,
  resolveBuqueTracking,
  searatesBlUrl,
} from "../buque-tracking";

describe("buque tracking por BL", () => {
  it("detecta COSCO y Maersk por el prefijo del BL", () => {
    assert.equal(detectarNaviera("COSU1234567890")?.nombre, "COSCO");
    assert.equal(detectarNaviera("maeu 998877")?.nombre, "Maersk");
    assert.equal(detectarNaviera("XYZ")?.nombre, undefined);
  });

  it("sin naviera conocida usa Searates", () => {
    const t = resolveBuqueTracking({ numeroBl: "ABC123" });
    assert.ok(t);
    assert.equal(t.navieraNombre, null);
    assert.equal(t.trackingUrl, searatesBlUrl("ABC123"));
  });

  it("cuenta días hasta la llegada del buque", () => {
    const hoy = new Date(Date.UTC(2026, 8, 4));
    assert.equal(diasHastaLlegadaBuque("2026-09-16", hoy), 12);
    assert.equal(diasHastaLlegadaBuque("2026-09-04", hoy), 0);
    assert.equal(diasHastaLlegadaBuque("2026-09-03", hoy), -1);
    assert.equal(etiquetaLlegadaBuque(12), "Llega en 12 d");
    assert.equal(etiquetaLlegadaBuque(0), "Llega hoy");
    assert.equal(etiquetaLlegadaBuque(-2), "Llegó hace 2 d");
    assert.equal(etiquetaLlegadaBuque(null), null);
    assert.equal(badgeContadorLlegada(12), "12 d");
    assert.equal(badgeContadorLlegada(1), "1 d");
    assert.equal(badgeContadorLlegada(0), "hoy");
    assert.equal(badgeContadorLlegada(-2), "llegó");
    assert.equal(badgeContadorLlegada(null), null);
  });

  it("sin BL no hay tracking", () => {
    assert.equal(resolveBuqueTracking({ numeroBl: "  " }), null);
  });
});
