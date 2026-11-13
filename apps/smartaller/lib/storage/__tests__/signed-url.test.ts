import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractStoragePathFromUrl,
  isSafeStoragePath,
  rewriteStorageUrlForClient,
  toAuthorizedFileUrl,
} from "../signed-url";

describe("storage signed urls", () => {
  it("rechaza path traversal", () => {
    assert.equal(isSafeStoragePath("../secret"), false);
    assert.equal(isSafeStoragePath("/abs"), false);
    assert.equal(isSafeStoragePath("a/../b"), false);
    assert.equal(isSafeStoragePath("taller/veh/doc.pdf"), true);
  });

  it("extrae path de URLs públicas de Supabase", () => {
    const extracted = extractStoragePathFromUrl(
      "https://xyz.supabase.co/storage/v1/object/public/vehiculos-documentos/t1/v1/cedula.pdf",
      "vehiculos-documentos"
    );
    assert.deepEqual(extracted, {
      bucket: "vehiculos-documentos",
      path: "t1/v1/cedula.pdf",
    });
  });

  it("reescribe URLs públicas a la ruta autorizada y conserva paths existentes", () => {
    const rewritten = rewriteStorageUrlForClient(
      "https://xyz.supabase.co/storage/v1/object/public/diagnosticos/t1/m1/foto.jpg",
      "t1/m1/foto.jpg",
      "diagnosticos"
    );
    assert.equal(
      rewritten,
      toAuthorizedFileUrl("diagnosticos", "t1/m1/foto.jpg")
    );
    assert.match(rewritten ?? "", /\/api\/storage\/file\?/);
  });
});
