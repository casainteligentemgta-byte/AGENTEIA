import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collapseColaPorBl,
  fechaLlegadaCargaBl,
  fichaHomogeneaBl,
  lineasMercanciaBl,
  mercanciaDelMismoBl,
  resumenUnidadesBl,
  sortUnidadesPorLlegada,
} from "../dashboard-cola-bl";
import { nextPlanillaFaseLote } from "../expediente-lote";

function v(
  id: string,
  codigo: string,
  bl: string | null,
  extra?: {
    marca?: string;
    modelo?: string;
    fechaLlegadaBuque?: string | null;
    vin?: string;
    color?: string;
  }
) {
  return {
    id,
    codigoExpediente: codigo,
    numeroBl: bl,
    created_at: "2026-08-01",
    marca: extra?.marca ?? "Chery",
    modelo: extra?.modelo ?? "Arrizo 5 Pro",
    fechaLlegadaBuque: extra?.fechaLlegadaBuque,
    color: extra?.color,
    vin: extra?.vin,
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

  it("en llegada ordena los BL por fecha del buque y deja sin fecha al final", () => {
    const collapsed = collapseColaPorBl(
      [
        v("a", "PL-2026.8.20", "TARDE", { fechaLlegadaBuque: "2026-09-20" }),
        v("b", "PL-2026.8.1", "PRONTO", { fechaLlegadaBuque: "2026-08-01" }),
        v("c", "PL-2026.8.10", "MEDIO", {
          fechaLlegadaBuque: "2026-08-15T14:00:00.000Z",
        }),
        v("d", "PL-2026.8.2", "SINFECHA", { fechaLlegadaBuque: null }),
        v("e", "PL-2026.8.3", null, { fechaLlegadaBuque: "2026-07-01" }),
      ],
      { sort: "llegada" }
    );
    const bls = collapsed.filter((g) => g.kind === "bl");
    assert.deepEqual(
      bls.map((g) => (g.kind === "bl" ? g.label : "")),
      ["PRONTO", "MEDIO", "TARDE", "SINFECHA"]
    );
    const suelto = collapsed[collapsed.length - 1];
    assert.equal(suelto?.kind, "unidad");
    if (suelto?.kind !== "unidad") return;
    assert.equal(suelto.item.codigoExpediente, "PL-2026.8.3");
  });

  it("lista la mercancía del BL de menor a mayor expediente", () => {
    const lineas = lineasMercanciaBl([
      v("b", "PL-2026.8.16", "321", { marca: "Toyota", modelo: "Corolla" }),
      v("a", "PL-2026.8.5", "321"),
    ]);
    assert.equal(lineas.length, 2);
    assert.equal(lineas[0]?.expediente, "PL-2026.8.5");
    assert.equal(lineas[0]?.detalle, "Chery · Arrizo 5 Pro");
    assert.equal(lineas[1]?.expediente, "PL-2026.8.16");
    assert.match(lineas[1]?.detalle ?? "", /Toyota/);
    assert.match(lineas[0]?.searchText ?? "", /Arrizo/);
  });

  it("incluye VIN y color en el texto filtrable de cada línea", () => {
    const lineas = lineasMercanciaBl([
      v("a", "PL-2026.8.5", "321", {
        color: "Blanco",
        vin: "LVVDB21B8ND123456",
      }),
    ]);
    assert.match(lineas[0]?.detalle ?? "", /Blanco/);
    assert.match(lineas[0]?.detalle ?? "", /LVVDB21B8ND123456/);
    assert.match(lineas[0]?.searchText ?? "", /LVVDB21B8ND123456/);
  });

  it("enlaza al BL toda la mercancía, no solo la que sigue en embarque", () => {
    const todos = [
      v("a", "PL-2026.8.5", "321"),
      v("b", "PL-2026.8.16", "321"),
      v("c", "PL-2026.8.4", "OTRO"),
    ];
    const linked = mercanciaDelMismoBl("321", todos);
    assert.deepEqual(
      linked.map((i) => i.codigoExpediente),
      ["PL-2026.8.5", "PL-2026.8.16"]
    );
  });

  it("en llegada lista cada expediente, por fecha del buque", () => {
    const sorted = sortUnidadesPorLlegada([
      v("a", "PL-2026.8.20", "TARDE", { fechaLlegadaBuque: "2026-09-20" }),
      v("b", "PL-2026.8.16", "PRONTO", { fechaLlegadaBuque: "2026-08-01" }),
      v("c", "PL-2026.8.5", "PRONTO", { fechaLlegadaBuque: "2026-08-01" }),
      v("d", "PL-2026.8.2", "SIN", { fechaLlegadaBuque: null }),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.codigoExpediente),
      ["PL-2026.8.5", "PL-2026.8.16", "PL-2026.8.20", "PL-2026.8.2"]
    );
  });

  it("toma la fecha de llegada del buque de los documentos de la carga", () => {
    assert.equal(
      fechaLlegadaCargaBl([
        v("a", "PL-2026.8.5", "321"),
        v("b", "PL-2026.8.6", "321", {
          fechaLlegadaBuque: "2026-08-12T08:00:00.000Z",
        }),
      ]),
      "2026-08-12"
    );
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
