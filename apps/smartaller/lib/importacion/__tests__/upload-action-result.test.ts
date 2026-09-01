import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { messageFromUploadResult } from "../upload-action-result";

describe("messageFromUploadResult", () => {
  it("no lee .success si la action no devolvió nada", () => {
    assert.match(messageFromUploadResult(undefined) ?? "", /liviana/);
    assert.match(messageFromUploadResult(null) ?? "", /liviana/);
  });

  it("usa el error de la action", () => {
    assert.equal(
      messageFromUploadResult({ success: false, error: "El archivo supera 10 MB" }),
      "El archivo supera 10 MB"
    );
  });

  it("ok no tiene mensaje", () => {
    assert.equal(messageFromUploadResult({ success: true }), null);
  });
});
