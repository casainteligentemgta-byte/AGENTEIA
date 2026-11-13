import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getPresidenciaPin,
  isPresidenciaProduction,
  PRESIDENCIA_PIN_MISSING_MSG,
  presidenciaAllowsOpenAccess,
  presidenciaPinConfigured,
} from "../pin";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void
): void {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(vars)) {
      const value = prev[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("presidencia PIN fail-closed", () => {
  it("en producción sin PIN no abre el kiosk", () => {
    withEnv({ NODE_ENV: "production", VERCEL_ENV: "production", PRESIDENCIA_PIN: "" }, () => {
      assert.equal(presidenciaPinConfigured(), false);
      assert.equal(isPresidenciaProduction(), true);
      assert.equal(presidenciaAllowsOpenAccess(), false);
      assert.match(PRESIDENCIA_PIN_MISSING_MSG, /PRESIDENCIA_PIN/);
    });
  });

  it("en producción con PIN no permite acceso abierto", () => {
    withEnv(
      { NODE_ENV: "production", VERCEL_ENV: "production", PRESIDENCIA_PIN: "1234" },
      () => {
        assert.equal(getPresidenciaPin(), "1234");
        assert.equal(presidenciaAllowsOpenAccess(), false);
      }
    );
  });

  it("en local sin PIN sigue abierto para desarrollo", () => {
    withEnv({ NODE_ENV: "development", VERCEL_ENV: undefined, PRESIDENCIA_PIN: undefined }, () => {
      assert.equal(isPresidenciaProduction(), false);
      assert.equal(presidenciaAllowsOpenAccess(), true);
    });
  });
});
