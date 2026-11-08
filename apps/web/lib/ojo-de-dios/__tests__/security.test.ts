import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { resolveOjoDeDiosAccess } from "../access";
import { isAllowedOAuthProvider } from "../config";
import { isSameOriginMutation, resetRateLimit } from "../rate-limit";
import { parseAllowlistedHttpsUrl, SafeFetchError } from "../safe-fetch";
import { sanitizeText, toHttpsUrl } from "../sanitize";
import { buildPublicBriefing, getOjoDeDiosSnapshot } from "../service";
import { clearPublicCache } from "../cache";
import type { FetchLike } from "../safe-fetch";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(body: string, status = 200, contentType = "application/xml"): Response {
  return new Response(body, { status, headers: { "Content-Type": contentType } });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): FetchLike {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url, init);
  };
}

const EMPTY_NEWS = `<?xml version="1.0"?><rss><channel><title>x</title></channel></rss>`;

describe("Ojo de Dios · seguridad", () => {
  const envKeys = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GARMIN_ACCESS_TOKEN",
    "X_BEARER_TOKEN",
    "OJO_DE_DIOS_OWNER_EMAIL",
    "OJO_DE_DIOS_OWNER_USER_ID",
  ] as const;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    clearPublicCache();
    resetRateLimit();
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    clearPublicCache();
  });

  it("bloquea SSRF: http, file, IPs privadas y hosts fuera de allowlist", () => {
    const allow = ["api.open-meteo.com"] as const;
    const blocked = [
      "http://api.open-meteo.com/v1/forecast",
      "file:///etc/passwd",
      "https://169.254.169.254/latest/meta-data",
      "https://127.0.0.1/",
      "https://evil.example/steal",
      "https://user:pass@api.open-meteo.com/v1",
    ];
    for (const url of blocked) {
      assert.throws(() => parseAllowlistedHttpsUrl(url, allow), SafeFetchError);
    }
    const ok = parseAllowlistedHttpsUrl("https://api.open-meteo.com/v1/forecast", allow);
    assert.equal(ok.hostname, "api.open-meteo.com");
  });

  it("escapa HTML/XSS de RSS y rechaza javascript:", () => {
    const dirty = `<script>alert(1)</script>Hola &lt;b&gt;Luis&lt;/b&gt;`;
    const clean = sanitizeText(dirty);
    assert.equal(clean.includes("<script>"), false);
    assert.equal(clean.includes("alert(1)"), false);
    assert.equal(clean, "Hola Luis");
    assert.equal(toHttpsUrl("javascript:alert(1)"), null);
    assert.equal(toHttpsUrl("https://news.google.com/rss/articles/abc"), "https://news.google.com/rss/articles/abc");
  });

  it("devuelve 404 si el flag está apagado y 401 sin sesión", () => {
    const disabled = resolveOjoDeDiosAccess({
      enabled: false,
      authRequired: true,
      user: { id: "u1", email: "luis@example.com" },
    });
    assert.equal(disabled.ok, false);
    if (!disabled.ok) assert.equal(disabled.status, 404);

    const anon = resolveOjoDeDiosAccess({ enabled: true, authRequired: true, user: null });
    assert.equal(anon.ok, false);
    if (!anon.ok) assert.equal(anon.status, 401);

    const ok = resolveOjoDeDiosAccess({
      enabled: true,
      authRequired: true,
      user: { id: "u1", email: "luis@example.com" },
    });
    assert.equal(ok.ok, true);
  });

  it("OAuth solo permite gmail, garmin y x", () => {
    assert.equal(isAllowedOAuthProvider("gmail"), true);
    assert.equal(isAllowedOAuthProvider("X"), true);
    assert.equal(isAllowedOAuthProvider("strava"), false);
    assert.equal(isAllowedOAuthProvider("https://evil"), false);
  });

  it("rechaza mutaciones de otro origen (CSRF)", () => {
    const headers = new Headers({
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    });
    assert.equal(isSameOriginMutation(headers, "https://web-sand-ten-60.vercel.app/api/ojo-de-dios/refresh"), false);

    const same = new Headers({
      origin: "https://web-sand-ten-60.vercel.app",
      "sec-fetch-site": "same-origin",
    });
    assert.equal(
      isSameOriginMutation(same, "https://web-sand-ten-60.vercel.app/api/ojo-de-dios/refresh"),
      true
    );
  });

  it("no usa Gmail/Garmin para otro usuario aunque existan tokens, y no filtra secretos", async () => {
    process.env.GMAIL_CLIENT_ID = "client-id-xyz";
    process.env.GMAIL_CLIENT_SECRET = "gmail-secret-xyz";
    process.env.GMAIL_REFRESH_TOKEN = "refresh-secret-xyz";
    process.env.GARMIN_ACCESS_TOKEN = "garmin-secret-xyz";
    process.env.OJO_DE_DIOS_OWNER_EMAIL = "luis@example.com";

    let gmailOrGarminCalls = 0;
    const fetchImpl = mockFetch((url) => {
      if (url.includes("gmail") || url.includes("googleapis") || url.includes("garmin")) {
        gmailOrGarminCalls += 1;
        return jsonResponse({ access_token: "should-not-happen" });
      }
      if (url.includes("open-meteo")) {
        return jsonResponse({
          current: {
            temperature_2m: 26,
            weather_code: 0,
            relative_humidity_2m: 50,
            wind_speed_10m: 8,
            time: "2026-11-08T10:00",
          },
        });
      }
      if (url.includes("news.google.com")) return textResponse(EMPTY_NEWS);
      if (url.includes("cinesunidos.com")) return textResponse("Just a moment...", 403, "text/html");
      return textResponse("nope", 404);
    });

    const snapshot = await getOjoDeDiosSnapshot(
      { id: "other-user", email: "otro@example.com" },
      { fetchImpl }
    );

    assert.equal(gmailOrGarminCalls, 0);
    assert.equal(snapshot.gmail.status, "needsAuth");
    assert.equal(snapshot.gmail.items.length, 0);
    assert.equal(snapshot.garmin.status, "needsAuth");
    const blob = JSON.stringify(snapshot);
    assert.equal(blob.includes("refresh-secret-xyz"), false);
    assert.equal(blob.includes("gmail-secret-xyz"), false);
    assert.equal(blob.includes("garmin-secret-xyz"), false);

    const briefing = buildPublicBriefing(snapshot);
    assert.equal(briefing.toLowerCase().includes("gmail"), false);
    assert.equal(briefing.toLowerCase().includes("correo"), false);
  });
});
