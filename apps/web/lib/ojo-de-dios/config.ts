/** Ciudades, feeds y sede de cine. URLs fijas en allowlist; no se aceptan URLs del usuario. */

export const OJO_DE_DIOS_USER_AGENT = "AgenteIA-OjoDeDios/1.0";

export const PUBLIC_CACHE_TTL_MS = 10 * 60 * 1000;
export const FETCH_TIMEOUT_MS = 8_000;
export const FETCH_MAX_BYTES = 400_000;

export const WEATHER_CITIES = [
  {
    id: "caracas",
    name: "Caracas",
    latitude: 10.4806,
    longitude: -66.9036,
    timezone: "America/Caracas",
  },
  {
    id: "margarita",
    name: "Margarita",
    latitude: 10.9579,
    longitude: -63.8497,
    timezone: "America/Caracas",
  },
  {
    id: "miami",
    name: "Miami",
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: "America/New_York",
  },
] as const;

export const OPEN_METEO_HOST = "api.open-meteo.com";

export const RSS_FEEDS = [
  {
    id: "venezuela",
    name: "Venezuela",
    url: "https://news.google.com/rss/headlines/section/geo/Venezuela?hl=es-419&gl=VE&ceid=VE:es-419",
  },
  {
    id: "florida",
    name: "Florida",
    url: "https://news.google.com/rss/headlines/section/geo/Florida,_United_States?hl=es-419&gl=US&ceid=US:es-419",
    fallbackUrl:
      "https://news.google.com/rss/search?q=Florida&hl=es-419&gl=US&ceid=US:es-419",
  },
] as const;

export const RSS_ALLOW_HOSTS = ["news.google.com"] as const;

/**
 * Sede preferida: Cines Unidos La Vela (Margarita).
 * La ruta /cines/3000 es la URL pública oficial de «Cine La Vela», no un ID inventado de API.
 */
export const CINEMA_VENUE = {
  chain: "Cines Unidos La Vela",
  venue: "Cines Unidos La Vela (Margarita)",
  officialUrl: "https://www.cinesunidos.com/cines/3000?city=margarita",
} as const;

export const CINEMA_ALLOW_HOSTS = ["www.cinesunidos.com", "cinesunidos.com"] as const;

export const GMAIL_ALLOW_HOSTS = [
  "oauth2.googleapis.com",
  "gmail.googleapis.com",
  "www.googleapis.com",
] as const;

export const GARMIN_ALLOW_HOSTS = ["apis.garmin.com"] as const;

export const X_ALLOW_HOSTS = ["api.twitter.com", "api.x.com"] as const;

/** Caracas y Miami (WOEID de Yahoo/X trends). */
export const X_TREND_PLACES = [
  { woeid: 395269, label: "Caracas" },
  { woeid: 2450022, label: "Miami" },
] as const;

export const NEWS_ITEM_LIMIT = 6;
export const GMAIL_ITEM_LIMIT = 8;
export const X_TREND_LIMIT = 8;

export const REFRESH_RATE_LIMIT_MAX = 8;
export const REFRESH_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

export const OAUTH_PROVIDERS = ["gmail", "garmin", "x"] as const;

export function isAllowedOAuthProvider(provider: string): boolean {
  return (OAUTH_PROVIDERS as readonly string[]).includes(provider.toLowerCase());
}
