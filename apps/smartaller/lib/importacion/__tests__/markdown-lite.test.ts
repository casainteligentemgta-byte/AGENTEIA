import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMarkdownLite } from "../markdown-lite";

describe("parseMarkdownLite", () => {
  it("parsea título, tabla y lista", () => {
    const blocks = parseMarkdownLite(
      [
        "# Título",
        "",
        "| Dato | Ok |",
        "|------|----|",
        "| VIN  | ☐  |",
        "",
        "- Uno",
        "- Dos",
      ].join("\n")
    );
    assert.deepEqual(blocks[0], { type: "h", level: 1, text: "Título" });
    assert.equal(blocks[1]?.type, "table");
    if (blocks[1]?.type === "table") {
      assert.deepEqual(blocks[1].headers, ["Dato", "Ok"]);
      assert.deepEqual(blocks[1].rows, [["VIN", "☐"]]);
    }
    assert.deepEqual(blocks[2], { type: "ul", items: ["Uno", "Dos"] });
  });
});
