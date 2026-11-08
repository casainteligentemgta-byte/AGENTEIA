import { X_ALLOW_HOSTS, X_TREND_LIMIT, X_TREND_PLACES } from "../config";
import { configuredSecret } from "../access";
import { SafeFetchError, safeFetch, type FetchLike } from "../safe-fetch";
import { sanitizeText, toHttpsUrl } from "../sanitize";
import type { XSection, XTrend } from "../types";

function xSection(
  status: XSection["status"],
  message: string | null,
  extras: Partial<XSection> = {}
): XSection {
  return {
    id: "x",
    label: "Tendencias de X",
    status,
    fetchedAt: status === "ok" ? new Date().toISOString() : null,
    sourceName: "X API",
    sourceUrl: "https://developer.x.com/",
    message,
    placeLabel: null,
    trends: [],
    ...extras,
  };
}

export function xHidden(): XSection {
  return xSection("hidden", null);
}

export async function fetchXTrends(fetchImpl?: FetchLike): Promise<XSection> {
  const bearer = configuredSecret(process.env.X_BEARER_TOKEN);
  if (!bearer) return xHidden();

  const trends: XTrend[] = [];
  const places: string[] = [];

  for (const place of X_TREND_PLACES) {
    const url = `https://api.twitter.com/1.1/trends/place.json?id=${place.woeid}`;
    try {
      const res = await safeFetch(url, {
        allowHosts: X_ALLOW_HOSTS,
        fetchImpl,
        headers: { Authorization: `Bearer ${bearer}` },
      });
      if (!res.ok) continue;
      const payload = JSON.parse(res.text) as Array<{
        trends?: Array<{ name?: string; url?: string }>;
      }>;
      const list = payload[0]?.trends ?? [];
      places.push(place.label);
      for (const trend of list) {
        const name = trend.name ? sanitizeText(trend.name, 80) : "";
        if (!name) continue;
        trends.push({
          name,
          url: trend.url ? toHttpsUrl(trend.url) : null,
        });
        if (trends.length >= X_TREND_LIMIT) break;
      }
    } catch (error) {
      if (error instanceof SafeFetchError && error.code === "ssrf") throw error;
    }
    if (trends.length >= X_TREND_LIMIT) break;
  }

  if (trends.length === 0) {
    return xSection("error", "No se pudieron leer tendencias de X.");
  }

  return xSection("ok", null, {
    placeLabel: places.join(" · ") || null,
    trends: trends.slice(0, X_TREND_LIMIT),
  });
}
