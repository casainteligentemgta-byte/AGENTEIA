import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findDuplicateSerialInList } from "../../vehicles/serial";

describe("findDuplicateSerialInList", () => {
  const rows = [
    { id: "a", serial_carroceria: "LVVDC21B5VD713650" },
    { id: "b", serial_carroceria: " lvvdb21b9vd812001 " },
  ];

  it("encuentra el mismo VIN aunque cambie el formato", () => {
    const hit = findDuplicateSerialInList(rows, "lvvdc21b5vd713650");
    assert.equal(hit?.id, "a");
  });

  it("no choca con otro VIN del lote", () => {
    assert.equal(
      findDuplicateSerialInList(rows, "LVVDB21B0VD000001"),
      null
    );
  });

  it("excluye el propio id", () => {
    assert.equal(
      findDuplicateSerialInList(rows, "LVVDC21B5VD713650", "a"),
      null
    );
  });
});
