import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { authEmailCallbackUrl, getAuthEmailOrigin } from "../app-url";

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_PROJECT_PRODUCTION_URL",
] as const;

const snapshot = Object.fromEntries(
  KEYS.map((k) => [k, process.env[k]])
) as Record<(typeof KEYS)[number], string | undefined>;

afterEach(() => {
  for (const k of KEYS) {
    const v = snapshot[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("auth email origin", () => {
  it("usa NEXT_PUBLIC_SITE_URL y apunta al callback PKCE", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://smarttaller.xyz";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL = "1";

    assert.equal(getAuthEmailOrigin(), "https://smarttaller.xyz");
    assert.equal(
      authEmailCallbackUrl("/reset-password?redirectTo=%2Fapp"),
      "https://smarttaller.xyz/auth/callback?next=%2Freset-password%3FredirectTo%3D%252Fapp"
    );
  });

  it("nunca emite localhost en producción si SITE_URL está mal", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.VERCEL = "1";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    assert.equal(getAuthEmailOrigin(), "https://smarttaller.xyz");
  });
});
