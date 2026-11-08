import { PUBLIC_CACHE_TTL_MS } from "./config";

type Entry<T> = { expiresAt: number; value: T };

const publicCache = new Map<string, Entry<unknown>>();

export function getPublicCache<T>(key: string): T | null {
  const entry = publicCache.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    publicCache.delete(key);
    return null;
  }
  return entry.value;
}

export function setPublicCache<T>(key: string, value: T, ttlMs = PUBLIC_CACHE_TTL_MS): T {
  publicCache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}

export function clearPublicCache(): void {
  publicCache.clear();
}
