import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStorageMimeRejected } from "../ocr-carga-job-mime";

describe("isStorageMimeRejected", () => {
  it("detecta el rechazo de JSON del bucket de documentos", () => {
    assert.equal(
      isStorageMimeRejected("mime type application/json is not supported"),
      true
    );
  });

  it("no marca errores de red como MIME", () => {
    assert.equal(isStorageMimeRejected("Failed to fetch"), false);
  });
});
