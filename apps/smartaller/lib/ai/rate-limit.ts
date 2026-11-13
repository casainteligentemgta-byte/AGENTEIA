import { checkRateLimit } from "@/lib/security/rate-limit";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function checkChatRateLimit(userId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  return checkRateLimit(`chat:${userId}`, { windowMs: WINDOW_MS, max: MAX_REQUESTS });
}
