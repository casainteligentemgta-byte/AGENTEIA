import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_DURACION_HORAS,
  demoExpiresAtFromNow,
  generateDemoPassword,
  getDemoCredentialsFromEnv,
  isDemoExpired,
  readDemoMetaFromAuthUser,
} from "../demo-access";

describe("demo-access", () => {
  it("genera claves con longitud y alfabeto seguro", () => {
    const pwd = generateDemoPassword(12);
    assert.equal(pwd.length, 12);
    assert.match(pwd, /^[A-Za-z0-9!@$%]+$/);
    const another = generateDemoPassword(12);
    assert.notEqual(pwd, another);
  });

  it("calcula caducidad desde ahora", () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const expires = demoExpiresAtFromNow(24, now);
    assert.equal(expires.toISOString(), "2026-09-08T12:00:00.000Z");
    assert.ok(DEMO_DURACION_HORAS.includes(24));
  });

  it("detecta demos caducadas", () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    assert.equal(isDemoExpired("2026-09-07T11:59:59.000Z", now), true);
    assert.equal(isDemoExpired("2026-09-07T12:00:01.000Z", now), false);
    assert.equal(isDemoExpired(null, now), false);
  });

  it("lee metadatos desde app_metadata", () => {
    const meta = readDemoMetaFromAuthUser({
      app_metadata: {
        es_demo: true,
        demo_expires_at: "2026-09-08T00:00:00.000Z",
      },
    });
    assert.equal(meta.esDemo, true);
    assert.equal(meta.expiresAt, "2026-09-08T00:00:00.000Z");
    assert.equal(meta.closed, false);
  });

  it("lee DEMO_EMAIL/DEMO_PASSWORD del entorno", () => {
    const prevEmail = process.env.DEMO_EMAIL;
    const prevPassword = process.env.DEMO_PASSWORD;
    process.env.DEMO_EMAIL = "demo@ejemplo.com";
    process.env.DEMO_PASSWORD = "ClaveFija123";
    try {
      const creds = getDemoCredentialsFromEnv();
      assert.deepEqual(creds, {
        email: "demo@ejemplo.com",
        password: "ClaveFija123",
      });
    } finally {
      if (prevEmail === undefined) delete process.env.DEMO_EMAIL;
      else process.env.DEMO_EMAIL = prevEmail;
      if (prevPassword === undefined) delete process.env.DEMO_PASSWORD;
      else process.env.DEMO_PASSWORD = prevPassword;
    }
  });
});
