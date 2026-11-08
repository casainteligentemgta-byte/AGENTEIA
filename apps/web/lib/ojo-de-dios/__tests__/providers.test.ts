import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { clearPublicCache } from "../cache";
import { parseRssItems } from "../providers/rss";
import { fetchCinema } from "../providers/cinema";
import { fetchGmail } from "../providers/gmail";
import { fetchGarmin } from "../providers/garmin";
import { fetchNews } from "../providers/rss";
import { fetchWeather } from "../providers/weather";
import { fetchXTrends } from "../providers/x";
import { getOjoDeDiosSnapshot } from "../service";
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

const RSS_VE = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title><![CDATA[Lluvias en Caracas - Diario Prueba]]></title>
  <link>https://news.google.com/rss/articles/abc</link>
  <pubDate>Sat, 07 Nov 2026 13:44:24 GMT</pubDate>
</item>
<item>
  <title>&lt;script&gt;alert(1)&lt;/script&gt;Titular sucio - Medio</title>
  <link>javascript:alert(1)</link>
  <pubDate>no-es-fecha</pubDate>
</item>
</channel></rss>`;

const RSS_FL = `<?xml version="1.0"?>
<rss><channel>
<item>
  <title>Recuento en Miami - Telemundo</title>
  <link>https://news.google.com/rss/articles/fl1</link>
  <pubDate>Sun, 08 Nov 2026 00:00:00 GMT</pubDate>
</item>
</channel></rss>`;

describe("Ojo de Dios · proveedores", () => {
  const envKeys = [
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "GARMIN_ACCESS_TOKEN",
    "X_BEARER_TOKEN",
    "OJO_DE_DIOS_OWNER_EMAIL",
  ] as const;
  const previous: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      previous[key] = process.env[key];
      delete process.env[key];
    }
    clearPublicCache();
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    clearPublicCache();
  });

  it("mapea Open-Meteo y no inventa temperaturas si falla", async () => {
    const ok = await fetchWeather(
      mockFetch((url) => {
        if (!url.includes("open-meteo")) return textResponse("no", 404);
        const miami = url.includes("25.7617");
        return jsonResponse({
          current: {
            temperature_2m: miami ? 28.4 : 26.1,
            weather_code: 0,
            relative_humidity_2m: 60,
            wind_speed_10m: 10,
            time: "2026-11-08T10:00",
          },
        });
      })
    );
    assert.equal(ok.status, "ok");
    assert.equal(ok.cities.length, 3);
    assert.equal(ok.cities[0]?.cityName, "Caracas");
    assert.equal(ok.cities[0]?.temperatureC, 26.1);

    clearPublicCache();
    const failed = await fetchWeather(mockFetch(() => textResponse("down", 503)));
    assert.equal(failed.status, "error");
    assert.equal(failed.cities.length, 0);
    assert.equal(failed.fetchedAt != null, true);
  });

  it("parsea RSS con editor, enlace https y fecha; descarta javascript y XSS", () => {
    const items = parseRssItems(RSS_VE);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Lluvias en Caracas");
    assert.equal(items[0]?.publisher, "Diario Prueba");
    assert.equal(items[0]?.url.startsWith("https://"), true);
    assert.equal(items[0]?.publishedAt, "2026-11-07T13:44:24.000Z");
  });

  it("usa fallback de Florida si el feed primario viene vacío", async () => {
    const news = await fetchNews(
      mockFetch((url) => {
        if (url.includes("search?q=Florida")) return textResponse(RSS_FL);
        if (url.includes("Venezuela")) return textResponse(RSS_VE);
        return textResponse(`<?xml version="1.0"?><rss><channel></channel></rss>`);
      })
    );
    assert.equal(news.status, "ok");
    const florida = news.feeds.find((feed) => feed.id === "florida");
    assert.equal(florida?.status, "ok");
    assert.equal(florida?.items[0]?.title.includes("Miami"), true);
  });

  it("cartelera Cloudflare o sin horarios queda unavailable, sin funciones inventadas", async () => {
    const blocked = await fetchCinema(
      mockFetch(() => textResponse("<html>Just a moment... cf-challenge</html>", 200, "text/html"))
    );
    assert.equal(blocked.status, "unavailable");
    assert.equal(blocked.movies.length, 0);
    assert.equal(blocked.venue, "Cines Unidos La Vela (Margarita)");
    assert.equal(blocked.sourceName, "Cines Unidos La Vela");

    clearPublicCache();
    const empty = await fetchCinema(
      mockFetch(() => textResponse("<html><h1>Cine La Vela</h1></html>", 200, "text/html"))
    );
    assert.equal(empty.status, "unavailable");
    assert.equal(empty.movies.length, 0);
  });

  it("acepta horarios solo si vienen confirmados en JSON-LD oficial", async () => {
    const html = `<html><script type="application/ld+json">${JSON.stringify({
      "@type": "ScreeningEvent",
      name: "Película de prueba",
      startDate: "2026-11-08T18:30:00-04:00",
    })}</script></html>`;
    const cinema = await fetchCinema(mockFetch(() => textResponse(html, 200, "text/html")));
    assert.equal(cinema.status, "ok");
    assert.equal(cinema.movies[0]?.title, "Película de prueba");
    assert.equal(cinema.movies[0]?.times.length > 0, true);
  });

  it("Gmail y Garmin sin credenciales: no conectado; X se oculta", async () => {
    const gmail = await fetchGmail({ allowed: true });
    const garmin = await fetchGarmin({ allowed: true });
    const x = await fetchXTrends();
    assert.equal(gmail.status, "needsAuth");
    assert.equal(gmail.items.length, 0);
    assert.equal(garmin.status, "needsAuth");
    assert.equal(x.status, "hidden");
    assert.equal(x.trends.length, 0);
  });

  it("Gmail solo lectura: GET de mensajes, nunca modify", async () => {
    process.env.GMAIL_CLIENT_ID = "id";
    process.env.GMAIL_CLIENT_SECRET = "secret";
    process.env.GMAIL_REFRESH_TOKEN = "refresh";
    const methods: string[] = [];
    const gmail = await fetchGmail({
      allowed: true,
      fetchImpl: mockFetch((url, init) => {
        methods.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
        if (url.includes("oauth2.googleapis.com/token")) {
          return jsonResponse({ access_token: "ya29.access" });
        }
        if (url.includes("/messages?") && !url.includes("/messages/abc")) {
          return jsonResponse({ messages: [{ id: "abc" }] });
        }
        if (url.includes("/messages/abc")) {
          assert.equal(url.includes("format=metadata"), true);
          return jsonResponse({
            id: "abc",
            snippet: "Reunión mañana",
            internalDate: "1731024000000",
            payload: {
              headers: [
                { name: "From", value: "Ana <ana@example.com>" },
                { name: "Subject", value: "Importante" },
              ],
            },
          });
        }
        return textResponse("no", 404);
      }),
    });
    assert.equal(gmail.status, "ok");
    assert.equal(gmail.items[0]?.subject, "Importante");
    assert.equal(methods.some((row) => /POST \/gmail/.test(row)), false);
    assert.equal(methods.some((row) => row.includes("modify")), false);
    assert.equal(methods.some((row) => row.includes("send")), false);
  });

  it("agrega fallos parciales: clima ok y noticias caídas no inventan titulares", async () => {
    const snapshot = await getOjoDeDiosSnapshot(null, {
      fetchImpl: mockFetch((url) => {
        if (url.includes("open-meteo")) {
          return jsonResponse({
            current: {
              temperature_2m: 27,
              weather_code: 61,
              relative_humidity_2m: 80,
              wind_speed_10m: 12,
              time: "2026-11-08T11:00",
            },
          });
        }
        return textResponse("fail", 500);
      }),
    });
    assert.equal(snapshot.weather.status, "ok");
    assert.equal(snapshot.weather.cities.length, 3);
    assert.equal(snapshot.news.status, "error");
    assert.equal(snapshot.news.feeds.every((feed) => feed.items.length === 0), true);
    assert.equal(snapshot.cinema.status, "unavailable");
    assert.equal(snapshot.x.status, "hidden");
  });
});
