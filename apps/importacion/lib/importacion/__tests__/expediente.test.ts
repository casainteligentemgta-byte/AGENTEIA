import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compareExpedienteLabelsAsc,
  compareExpedientesAsc,
} from "../expediente";

describe("orden de expediente", () => {
  it("PL-2026.8.5 va antes que PL-2026.8.16 (número, no texto)", () => {
    const items = [
      { codigoExpediente: "PL-2026.8.16", created_at: "2026-08-20" },
      { codigoExpediente: "PL-2026.8.5", created_at: "2026-08-10" },
      { codigoExpediente: "PL-2026.8.7", created_at: "2026-08-12" },
      { codigoExpediente: "PL-2026.8.18", created_at: "2026-08-22" },
      { codigoExpediente: "PL-2026.8.6", created_at: "2026-08-11" },
      { codigoExpediente: "PL-2026.8.4", created_at: "2026-08-09" },
    ];
    assert.deepEqual(
      items.sort(compareExpedientesAsc).map((i) => i.codigoExpediente),
      [
        "PL-2026.8.4",
        "PL-2026.8.5",
        "PL-2026.8.6",
        "PL-2026.8.7",
        "PL-2026.8.16",
        "PL-2026.8.18",
      ]
    );
  });

  it("ordena celdas con semáforo delante del código", () => {
    const cells = [
      "● PL-2026.8.16",
      "● PL-2026.8.5",
      "PL-2026.8.4",
    ];
    assert.deepEqual(cells.sort(compareExpedienteLabelsAsc), [
      "PL-2026.8.4",
      "● PL-2026.8.5",
      "● PL-2026.8.16",
    ]);
  });
});
