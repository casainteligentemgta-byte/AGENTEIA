import { CINEMA_ALLOW_HOSTS, CINEMA_VENUE } from "../config";
import { getPublicCache, setPublicCache } from "../cache";
import { SafeFetchError, safeFetch, type FetchLike } from "../safe-fetch";
import { sanitizeText } from "../sanitize";
import type { CinemaSection, CinemaShow } from "../types";

function cinemaResult(
  status: CinemaSection["status"],
  message: string | null,
  movies: CinemaShow[] = []
): CinemaSection {
  return {
    id: "cinema",
    label: "Cartelera",
    status,
    fetchedAt: new Date().toISOString(),
    sourceName: CINEMA_VENUE.chain,
    sourceUrl: CINEMA_VENUE.officialUrl,
    message,
    venue: CINEMA_VENUE.venue,
    movies,
  };
}

const TIME_RE = /\b([01]?\d|2[0-3]):[0-5]\d\b/;

function parseJsonLdMovies(html: string): CinemaShow[] {
  const scripts = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!scripts) return [];
  const movies: CinemaShow[] = [];
  for (const script of scripts) {
    const raw = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    try {
      const parsed: unknown = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        collectScreenings(node, movies);
      }
    } catch {
      // JSON-LD inválido: se ignora, no se inventan horarios.
    }
  }
  return dedupeMovies(movies);
}

function collectScreenings(node: unknown, movies: CinemaShow[]): void {
  if (!node || typeof node === "string" || typeof node === "number") return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectScreenings(item, movies));
    return;
  }
  if (typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const type = String(record["@type"] ?? "");
  if (/Movie|ScreeningEvent/i.test(type)) {
    const title = sanitizeText(String(record.name ?? record.workPresented ?? ""), 160);
    const start = typeof record.startDate === "string" ? record.startDate : null;
    if (title) {
      const time = start ? formatShowTime(start) : null;
      movies.push({
        title,
        times: time ? [time] : [],
        format: typeof record.videoFormat === "string" ? sanitizeText(record.videoFormat, 40) : null,
      });
    }
  }
  if (record["@graph"]) collectScreenings(record["@graph"], movies);
}

function formatShowTime(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const match = iso.match(TIME_RE);
    return match ? match[0] : null;
  }
  return date.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function parseVisibleShowtimes(html: string): CinemaShow[] {
  const movies: CinemaShow[] = [];
  const blocks =
    html.match(/<(?:article|li|div)[^>]{0,200}(?:movie|pelicula|film)[^>]*>[\s\S]{0,1200}?<\/(?:article|li|div)>/gi) ??
    [];
  for (const block of blocks) {
    const heading = block.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const title = heading ? sanitizeText(heading[1], 160) : "";
    const times = Array.from(block.matchAll(/\b([01]?\d|2[0-3]):[0-5]\d\b/g)).map((m) => m[0]);
    if (title && times.length > 0) {
      movies.push({ title, times: Array.from(new Set(times)).slice(0, 8), format: null });
    }
  }
  return dedupeMovies(movies);
}

function dedupeMovies(movies: CinemaShow[]): CinemaShow[] {
  const byTitle = new Map<string, CinemaShow>();
  for (const movie of movies) {
    const key = movie.title.toLowerCase();
    const prev = byTitle.get(key);
    if (!prev) {
      byTitle.set(key, movie);
      continue;
    }
    prev.times = Array.from(new Set([...prev.times, ...movie.times])).slice(0, 8);
  }
  return Array.from(byTitle.values()).slice(0, 12);
}

export async function fetchCinema(fetchImpl?: FetchLike): Promise<CinemaSection> {
  const cached = getPublicCache<CinemaSection>("cinema");
  if (cached) return cached;

  try {
    const res = await safeFetch(CINEMA_VENUE.officialUrl, {
      allowHosts: CINEMA_ALLOW_HOSTS,
      fetchImpl,
    });
    if (!res.ok) {
      return cinemaResult(
        "unavailable",
        "La cartelera oficial no está disponible ahora. Ábrela en Cines Unidos La Vela."
      );
    }
    if (/just a moment|cf-challenge|cloudflare/i.test(res.text)) {
      return cinemaResult(
        "unavailable",
        "Cines Unidos La Vela protege la página (Cloudflare). No se inventan horarios; usa el enlace oficial."
      );
    }
    const movies = [...parseJsonLdMovies(res.text), ...parseVisibleShowtimes(res.text)];
    const unique = dedupeMovies(movies).filter((movie) => movie.times.length > 0);
    if (unique.length === 0) {
      return cinemaResult(
        "unavailable",
        "No hay horarios confirmados en la fuente oficial en este momento."
      );
    }
    return setPublicCache("cinema", cinemaResult("ok", null, unique));
  } catch (error) {
    if (error instanceof SafeFetchError && error.code === "ssrf") throw error;
    return cinemaResult(
      "unavailable",
      "No se pudo leer la cartelera oficial. No se muestran horarios inventados."
    );
  }
}
