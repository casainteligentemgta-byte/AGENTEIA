const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkChatRateLimit(userId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}
