import { REFRESH_RATE_LIMIT_MAX, REFRESH_RATE_LIMIT_WINDOW_MS } from "./config";

const hits = new Map<string, number[]>();

export function consumeRateLimit(
  key: string,
  max = REFRESH_RATE_LIMIT_MAX,
  windowMs = REFRESH_RATE_LIMIT_WINDOW_MS
): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetRateLimit(): void {
  hits.clear();
}

const ALLOWED_FETCH_SITES = new Set(["same-origin", "none"]);

export function isSameOriginMutation(
  headers: Pick<Headers, "get">,
  requestUrl: string
): boolean {
  const site = headers.get("sec-fetch-site");
  if (site && !ALLOWED_FETCH_SITES.has(site)) return false;

  const origin = headers.get("origin");
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    const requestHost = new URL(requestUrl).host;
    if (originHost === requestHost) return true;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl && new URL(siteUrl).host === originHost) return true;
    return false;
  } catch {
    return false;
  }
}
