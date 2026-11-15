import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLAIM_CODE_LENGTH,
  claimCodesEqual,
  generateClaimCode,
  normalizeClaimCode,
} from "../claim-code";

describe("claim-code", () => {
  it("genera códigos de longitud fija sin caracteres ambiguos", () => {
    const code = generateClaimCode(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
    assert.equal(code.length, CLAIM_CODE_LENGTH);
    assert.match(code, /^[A-HJ-NP-Z2-9]+$/);
    const another = generateClaimCode(Buffer.from([9, 10, 11, 12, 13, 14, 15, 16]));
    assert.notEqual(code, another);
  });

  it("normaliza y compara en tiempo constante", () => {
    assert.equal(normalizeClaimCode(" ab-12cd "), "AB12CD");
    assert.equal(claimCodesEqual("ABCD2345", "abcd2345"), true);
    assert.equal(claimCodesEqual("ABCD2345", "XXXX2345"), false);
    assert.equal(claimCodesEqual(null, "ABCD2345"), false);
    assert.equal(claimCodesEqual("ABCD2345", ""), false);
    assert.equal(claimCodesEqual("SHORT", "SHORT"), false);
  });
});
