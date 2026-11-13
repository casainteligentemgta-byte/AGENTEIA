import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDetailedHealthAuthorized,
  publicHealthPayload,
  telegramIntegrationStatus,
  telegramWebhookSecretStatus,
} from "../health";

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
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

describe("health", () => {
  it("el reporte público solo expone ok/fail", () => {
    assert.deepEqual(publicHealthPayload(true), { status: "ok" });
    assert.deepEqual(publicHealthPayload(false), { status: "fail" });
    assert.equal("sha" in publicHealthPayload(true), false);
    assert.equal("checks" in publicHealthPayload(true), false);
  });

  it("exige CRON_SECRET por Bearer para el detalle", () => {
    withEnv({ CRON_SECRET: "s3cret" }, () => {
      const ok = new Request("http://localhost/api/health", {
        headers: { authorization: "Bearer s3cret" },
      });
      const bad = new Request("http://localhost/api/health");
      assert.equal(isDetailedHealthAuthorized(ok), true);
      assert.equal(isDetailedHealthAuthorized(bad), false);
    });
  });

  it("telegram no es ok si falta TELEGRAM_WEBHOOK_SECRET", () => {
    withEnv(
      { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_WEBHOOK_SECRET: undefined },
      () => {
        assert.equal(telegramIntegrationStatus(), "error");
        assert.equal(telegramWebhookSecretStatus(), "error");
      }
    );
    withEnv(
      { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_WEBHOOK_SECRET: "whsec" },
      () => {
        assert.equal(telegramIntegrationStatus(), "ok");
        assert.equal(telegramWebhookSecretStatus(), "ok");
      }
    );
  });
});
