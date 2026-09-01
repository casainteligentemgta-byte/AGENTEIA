import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blMercanciaExpandida,
  toggleCollapsedBlId,
} from "../dashboard-bl-expand";

describe("toggleCollapsedBlId", () => {
  it("contrae un BL expandido y lo vuelve a abrir", () => {
    const closed = toggleCollapsedBlId(new Set(), "bl-2-321");
    assert.equal(closed.has("bl-2-321"), true);
    assert.equal(blMercanciaExpandida(closed, "bl-2-321"), false);

    const open = toggleCollapsedBlId(closed, "bl-2-321");
    assert.equal(open.has("bl-2-321"), false);
    assert.equal(blMercanciaExpandida(open, "bl-2-321"), true);
  });

  it("un filtro fuerza la mercancía visible", () => {
    const closed = new Set(["bl-2-321"]);
    assert.equal(blMercanciaExpandida(closed, "bl-2-321", true), true);
    assert.equal(blMercanciaExpandida(closed, "bl-2-321", false), false);
  });
});
