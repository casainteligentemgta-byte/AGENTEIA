import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_COUNTRY_CODE,
  WHATSAPP_DISABLED_LOG,
  enviarWhatsApp,
  isWhatsAppEnabled,
  normalizeTelefono,
  waMeHref,
  whatsappHealthStatus,
} from "../whatsapp";

const ENV_KEYS = [
  "WHATSAPP_ENABLED",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_WHATSAPP_FROM",
  "TWILIO_CONTENT_SID_RECORDATORIO",
  "TWILIO_CONTENT_SID_CONFIRMACION",
  "TWILIO_CONTENT_SID_PAGO",
] as const;

const snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])) as Record<
  (typeof ENV_KEYS)[number],
  string | undefined
>;

const originalFetch = globalThis.fetch;
const originalLog = console.log;

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return fn();
}

const ENABLED_CREDS = {
  WHATSAPP_ENABLED: "true",
  TWILIO_ACCOUNT_SID: "ACtestsid",
  TWILIO_AUTH_TOKEN: "test-token",
  TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
} as const;

afterEach(() => {
  restoreEnv();
  globalThis.fetch = originalFetch;
  console.log = originalLog;
});

describe("normalizeTelefono (Venezuela +58)", () => {
  it("usa 58 como prefijo por defecto", () => {
    assert.equal(DEFAULT_COUNTRY_CODE, "58");
  });

  it("acepta 0414xxxxxxx", () => {
    assert.equal(normalizeTelefono("04141234567"), "584141234567");
    assert.equal(normalizeTelefono("0414-123-4567"), "584141234567");
  });

  it("acepta 414xxxxxxx", () => {
    assert.equal(normalizeTelefono("4141234567"), "584141234567");
  });

  it("acepta +58 y 58", () => {
    assert.equal(normalizeTelefono("+584141234567"), "584141234567");
    assert.equal(normalizeTelefono("584141234567"), "584141234567");
    assert.equal(normalizeTelefono("+58 414 123 4567"), "584141234567");
    assert.equal(normalizeTelefono("58 4141234567"), "584141234567");
  });

  it("quita el 0 de tronco tras +58", () => {
    assert.equal(normalizeTelefono("+58 0414 1234567"), "584141234567");
    assert.equal(normalizeTelefono("5804141234567"), "584141234567");
  });

  it("conserva otro código de país ya internacional", () => {
    assert.equal(normalizeTelefono("573001234567"), "573001234567");
  });

  it("rechaza entradas vacías o cortas", () => {
    assert.throws(() => normalizeTelefono(""), /inválido/);
    assert.throws(() => normalizeTelefono("abc"), /inválido/);
    assert.throws(() => normalizeTelefono("0414"), /inválido/);
  });

  it("arma wa.me con el número VE", () => {
    assert.equal(
      waMeHref("04141234567", "hola"),
      "https://wa.me/584141234567?text=hola"
    );
  });
});

describe("kill switch WhatsApp", () => {
  it("está apagado por defecto y el health reporta skipped", () => {
    withEnv(
      {
        WHATSAPP_ENABLED: undefined,
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_WHATSAPP_FROM: undefined,
      },
      () => {
        assert.equal(isWhatsAppEnabled(), false);
        assert.equal(whatsappHealthStatus(), "skipped");
      }
    );
  });

  it("no envía si WHATSAPP_ENABLED no es el literal true", async () => {
    const calls: unknown[] = [];
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls.push(args);
      throw new Error("fetch no debería llamarse");
    }) as typeof fetch;

    const logs: string[] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    await withEnv(
      {
        WHATSAPP_ENABLED: "1",
        TWILIO_ACCOUNT_SID: "ACtestsid",
        TWILIO_AUTH_TOKEN: "test-token",
        TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
      },
      async () => {
        const result = await enviarWhatsApp("04141234567", "hola");
        assert.deepEqual(result, { ok: false, skipped: true });
        assert.equal(calls.length, 0);
        assert.ok(logs.some((line) => line.includes(WHATSAPP_DISABLED_LOG)));
        assert.equal(whatsappHealthStatus(), "skipped");
      }
    );
  });

  it("no envía si falta alguna credencial Twilio aunque el flag esté en true", async () => {
    const calls: unknown[] = [];
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      calls.push(args);
      throw new Error("fetch no debería llamarse");
    }) as typeof fetch;

    await withEnv(
      {
        WHATSAPP_ENABLED: "true",
        TWILIO_ACCOUNT_SID: "ACtestsid",
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_WHATSAPP_FROM: "whatsapp:+14155238886",
      },
      async () => {
        const result = await enviarWhatsApp("4141234567", "hola");
        assert.equal(result.ok, false);
        assert.equal(result.skipped, true);
        assert.equal(calls.length, 0);
        assert.equal(whatsappHealthStatus(), "skipped");
        assert.equal(isWhatsAppEnabled(), false);
      }
    );
  });

  it("no lanza cuando está deshabilitado", async () => {
    await withEnv({ WHATSAPP_ENABLED: undefined }, async () => {
      await assert.doesNotReject(() => enviarWhatsApp("04141234567", "hola"));
    });
  });

  it("llama a Twilio REST cuando el flag y las credenciales están presentes", async () => {
    const captured: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ sid: "SM123", status: "queued" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    await withEnv({ ...ENABLED_CREDS }, async () => {
      assert.equal(isWhatsAppEnabled(), true);
      assert.equal(whatsappHealthStatus(), "ok");
      const result = await enviarWhatsApp("04141234567", "recordatorio de prueba");
      assert.deepEqual(result, { ok: true });
      assert.equal(captured.length, 1);
      assert.match(captured[0].url, /Accounts\/ACtestsid\/Messages\.json/);
      const body = String(captured[0].init.body);
      assert.match(body, /To=whatsapp%3A%2B584141234567/);
      assert.match(body, /From=whatsapp%3A%2B14155238886/);
      assert.match(body, /Body=recordatorio/);
      const auth = (captured[0].init.headers as Record<string, string>).Authorization;
      assert.equal(auth, `Basic ${Buffer.from("ACtestsid:test-token").toString("base64")}`);
    });
  });

  it("usa ContentSid y ContentVariables si hay template aprobado", async () => {
    const captured: { init: RequestInit }[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({ init: init ?? {} });
      return new Response(JSON.stringify({ sid: "SM999" }), { status: 201 });
    }) as typeof fetch;

    await withEnv(
      { ...ENABLED_CREDS, TWILIO_CONTENT_SID_RECORDATORIO: "HXrecordatorio" },
      async () => {
        const result = await enviarWhatsApp("4141234567", "texto libre", {
          type: "recordatorio",
          variables: ["Ana", "ABC123", "1 de diciembre"],
        });
        assert.equal(result.ok, true);
        const body = String(captured[0].init.body);
        assert.match(body, /ContentSid=HXrecordatorio/);
        assert.match(body, /ContentVariables=/);
        assert.doesNotMatch(body, /Body=/);
      }
    );
  });

  it("devuelve error de Twilio sin lanzar", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ code: 21211, message: "Invalid To" }), {
        status: 400,
      })) as typeof fetch;

    await withEnv({ ...ENABLED_CREDS }, async () => {
      const result = await enviarWhatsApp("04141234567", "hola");
      assert.equal(result.ok, false);
      assert.equal(result.skipped, undefined);
      assert.match(result.error ?? "", /21211/);
    });
  });
});
