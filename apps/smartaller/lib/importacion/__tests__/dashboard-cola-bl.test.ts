import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collapseColaPorBl,
  fichaHomogeneaBl,
  resumenUnidadesBl,
} from "../dashboard-cola-bl";
import { nextPlanillaFaseLote } from "../expediente-lote";

function v(
  id: string,
  codigo: string,
  bl: string | null,
  extra?: { marca?: string; modelo?: string }
) {
  return {
    id,
    codigoExpediente: codigo,
    numeroBl: bl,
    created_at: "2026-08-01",
    marca: extra?.marca ?? "Chery",
    modelo: extra?.modelo ?? "Arrizo 5 Pro",
  };
}

describe("cola embarque/llegada por BL", () => {
  it("agrupa el mismo BL en una fila y deja sin BL sueltos", () => {
    const collapsed = collapseColaPorBl([
      v("a", "PL-2026.8.16", "COSU 123"),
      v("b", "PL-2026.8.5", "cosu123"),
      v("c", "PL-2026.8.4", null),
      v("d", "PL-2026.8.7", "OTRO"),
    ]);
    assert.equal(collapsed[0]?.kind, "bl");
    if (collapsed[0]?.kind !== "bl") return;
    assert.equal(collapsed[0].blKey, "COSU123");
    assert.deepEqual(
      collapsed[0].items.map((i) => i.codigoExpediente),
      ["PL-2026.8.5", "PL-2026.8.16"]
    );
    assert.equal(collapsed[1]?.kind, "bl");
    if (collapsed[1]?.kind !== "bl") return;
    assert.equal(collapsed[1].label, "OTRO");
    assert.equal(collapsed[2]?.kind, "unidad");
    if (collapsed[2]?.kind !== "unidad") return;
    assert.equal(collapsed[2].item.codigoExpediente, "PL-2026.8.4");
  });

  it("resume unidades y códigos del BL", () => {
    assert.equal(
      resumenUnidadesBl([
        { codigoExpediente: "PL-2026.8.4" },
        { codigoExpediente: "PL-2026.8.5" },
      ]),
      "2 vehículos · PL-2026.8.4, PL-2026.8.5"
    );
  });

  it("ficha del lote solo si marca y modelo coinciden", () => {
    const same = fichaHomogeneaBl([
      v("a", "PL-2026.8.4", "X"),
      v("b", "PL-2026.8.5", "X"),
    ]);
    assert.equal(same.marca, "Chery");
    assert.equal(same.modelo, "Arrizo 5 Pro");
    assert.equal(same.vin, null);
    const mixed = fichaHomogeneaBl([
      v("a", "PL-2026.8.4", "X", { marca: "Chery" }),
      v("b", "PL-2026.8.5", "X", { marca: "Toyota", modelo: "Corolla" }),
    ]);
    assert.equal(mixed.marca, null);
  });
});

describe("nextPlanillaFaseLote", () => {
  const embarqueDocs = {
    bl_guia: { url: "https://x/bl.pdf", path: "bl" },
    lista_empaque: { url: "https://x/l.pdf", path: "l" },
  };
  const llegadaDocs = {
    ...embarqueDocs,
    acta_recepcion_mercancia: { url: "https://x/ar.pdf", path: "ar" },
    constancia_edi_reconocimiento: { url: "https://x/edi.pdf", path: "edi" },
  };

  it("no toca registro ni etapas 4+", () => {
    assert.equal(
      nextPlanillaFaseLote({
        faseActual: 1,
        docs: llegadaDocs,
        fechaLlegadaBuque: "2026-08-01",
        fechaIngreso: "2026-08-10",
      }),
      1
    );
    assert.equal(
      nextPlanillaFaseLote({
        faseActual: 4,
        docs: llegadaDocs,
        fechaLlegadaBuque: "2026-08-01",
        fechaIngreso: "2026-08-10",
      }),
      4
    );
  });

  it("cierra embarque con BL, lista y fecha del buque", () => {
    assert.equal(
      nextPlanillaFaseLote({
        faseActual: 2,
        docs: embarqueDocs,
        fechaLlegadaBuque: "2026-08-01",
        fechaIngreso: null,
      }),
      3
    );
    assert.equal(
      nextPlanillaFaseLote({
        faseActual: 2,
        docs: embarqueDocs,
        fechaLlegadaBuque: null,
        fechaIngreso: null,
      }),
      2
    );
  });

  it("cierra llegada de carga con ingreso + AR + EDI, sin fotos", () => {
    assert.equal(
      nextPlanillaFaseLote({
        faseActual: 3,
        docs: llegadaDocs,
        fechaLlegadaBuque: "2026-08-01",
        fechaIngreso: "2026-08-10",
      }),
      4
    );
    assert.equal(
      nextPlanillaFaseLote({
        faseActual: 2,
        docs: llegadaDocs,
        fechaLlegadaBuque: "2026-08-01",
        fechaIngreso: "2026-08-10",
      }),
      4
    );
  });
});
