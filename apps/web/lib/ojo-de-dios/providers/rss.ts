import { NEWS_ITEM_LIMIT, RSS_ALLOW_HOSTS, RSS_FEEDS } from "../config";
import { getPublicCache, setPublicCache } from "../cache";
import { SafeFetchError, safeFetch, type FetchLike } from "../safe-fetch";
import { sanitizeText, toHttpsUrl } from "../sanitize";
import type { NewsFeed, NewsItem, NewsSection } from "../types";

function emptyNews(message: string, status: NewsSection["status"]): NewsSection {
  return {
    id: "news",
    label: "Titulares",
    status,
    fetchedAt: null,
    sourceName: "Google News RSS",
    sourceUrl: "https://news.google.com/",
    message,
    feeds: [],
  };
}

function firstTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1] : null;
}

function parseRfc2822(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(sanitizeText(value, 80));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function splitTitleAndPublisher(title: string): { title: string; publisher: string | null } {
  const parts = title.split(" - ");
  if (parts.length < 2) return { title, publisher: null };
  const publisher = parts.pop()?.trim() || null;
  return { title: parts.join(" - ").trim(), publisher };
}

export function parseRssItems(xml: string, limit = NEWS_ITEM_LIMIT): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    if (items.length >= limit) break;
    const rawTitle = firstTag(block, "title");
    const rawLink = firstTag(block, "link");
    const rawDate = firstTag(block, "pubDate");
    const titleFull = rawTitle ? sanitizeText(rawTitle, 220) : "";
    const url = rawLink ? toHttpsUrl(sanitizeText(rawLink, 500)) : null;
    if (!titleFull || !url) continue;
    const { title, publisher } = splitTitleAndPublisher(titleFull);
    items.push({
      title: title || titleFull,
      url,
      publisher,
      publishedAt: parseRfc2822(rawDate),
    });
  }
  return items;
}

async function loadFeed(
  url: string,
  fetchImpl?: FetchLike
): Promise<{ items: NewsItem[]; fetchedAt: string } | null> {
  try {
    const res = await safeFetch(url, {
      allowHosts: RSS_ALLOW_HOSTS,
      fetchImpl,
    });
    if (!res.ok) return null;
    const items = parseRssItems(res.text);
    if (items.length === 0) return null;
    return { items, fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof SafeFetchError && error.code === "ssrf") throw error;
    return null;
  }
}

export async function fetchNews(fetchImpl?: FetchLike): Promise<NewsSection> {
  const cached = getPublicCache<NewsSection>("news");
  if (cached) return cached;

  const feeds: NewsFeed[] = [];

  for (const feed of RSS_FEEDS) {
    const primary = await loadFeed(feed.url, fetchImpl);
    const fallbackUrl = "fallbackUrl" in feed ? feed.fallbackUrl : undefined;
    const loaded =
      primary ?? (fallbackUrl ? await loadFeed(fallbackUrl, fetchImpl) : null);
    if (!loaded) {
      feeds.push({
        id: feed.id,
        label: feed.name,
        items: [],
        status: "error",
        fetchedAt: null,
        sourceUrl: feed.url,
        message: "No se pudieron leer titulares de esta fuente.",
      });
      continue;
    }
    feeds.push({
      id: feed.id,
      label: feed.name,
      items: loaded.items,
      status: "ok",
      fetchedAt: loaded.fetchedAt,
      sourceUrl: feed.url,
      message: null,
    });
  }

  const okCount = feeds.filter((feed) => feed.status === "ok").length;
  if (okCount === 0) {
    return emptyNews("No se pudieron cargar los titulares.", "error");
  }

  const section: NewsSection = {
    id: "news",
    label: "Titulares",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    sourceName: "Google News RSS",
    sourceUrl: "https://news.google.com/",
    message: okCount < feeds.length ? "Algunas fuentes no respondieron." : null,
    feeds,
  };
  return setPublicCache("news", section);
}
