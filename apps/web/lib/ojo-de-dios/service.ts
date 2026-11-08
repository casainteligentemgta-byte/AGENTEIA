import { collectConfiguredSecrets, isPersonalOwner, type SessionUser } from "./access";
import { assertNoSecrets } from "./sanitize";
import { fetchCinema } from "./providers/cinema";
import { fetchGarmin } from "./providers/garmin";
import { fetchGmail } from "./providers/gmail";
import { fetchNews } from "./providers/rss";
import { fetchWeather } from "./providers/weather";
import { fetchXTrends } from "./providers/x";
import type { FetchLike } from "./safe-fetch";
import type { OjoDeDiosSnapshot } from "./types";

export type SnapshotDeps = {
  fetchImpl?: FetchLike;
  now?: Date;
};

export async function getOjoDeDiosSnapshot(
  user: SessionUser | null,
  deps: SnapshotDeps = {}
): Promise<OjoDeDiosSnapshot> {
  const owner = isPersonalOwner(user);
  const fetchImpl = deps.fetchImpl;

  const [weather, news, cinema, x, gmail, garmin] = await Promise.all([
    fetchWeather(fetchImpl),
    fetchNews(fetchImpl),
    fetchCinema(fetchImpl),
    fetchXTrends(fetchImpl),
    fetchGmail({ allowed: owner, fetchImpl }),
    fetchGarmin({ allowed: owner, fetchImpl }),
  ]);

  const snapshot: OjoDeDiosSnapshot = {
    generatedAt: (deps.now ?? new Date()).toISOString(),
    weather,
    news,
    x,
    garmin,
    gmail,
    cinema,
  };

  assertNoSecrets(snapshot, collectConfiguredSecrets());
  return snapshot;
}

/** Texto público por defecto: clima, noticias y cine. Nunca salud ni correo. */
export function buildPublicBriefing(snapshot: OjoDeDiosSnapshot): string {
  const lines: string[] = ["Ojo de Dios", snapshot.generatedAt, ""];

  lines.push("Clima");
  if (snapshot.weather.cities.length === 0) {
    lines.push(snapshot.weather.message ?? "Sin datos de clima.");
  } else {
    for (const city of snapshot.weather.cities) {
      lines.push(
        `${city.cityName}: ${city.temperatureC} °C, ${city.weatherLabel}` +
          (city.observedAt ? ` (${city.observedAt})` : "")
      );
    }
  }

  lines.push("", "Titulares");
  for (const feed of snapshot.news.feeds) {
    lines.push(`— ${feed.label}`);
    if (feed.items.length === 0) {
      lines.push(feed.message ?? "Sin titulares.");
      continue;
    }
    for (const item of feed.items.slice(0, 4)) {
      const when = item.publishedAt ? ` [${item.publishedAt}]` : "";
      const publisher = item.publisher ? ` (${item.publisher})` : "";
      lines.push(`• ${item.title}${publisher}${when}`);
    }
  }

  lines.push("", `Cine · ${snapshot.cinema.venue}`);
  if (snapshot.cinema.movies.length === 0) {
    lines.push(snapshot.cinema.message ?? "Cartelera no disponible.");
  } else {
    for (const movie of snapshot.cinema.movies) {
      lines.push(`• ${movie.title}${movie.times.length ? ` — ${movie.times.join(", ")}` : ""}`);
    }
  }

  return lines.join("\n");
}
