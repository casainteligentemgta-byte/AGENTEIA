import { randomBytes, timingSafeEqual } from "node:crypto";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const CLAIM_CODE_LENGTH = 8;
/** Sin 0/O/1/I para dictarlo en recepción. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CLAIM_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CLAIM_RATE_MAX = 5;

export const CLAIM_ERROR_GENERIC =
  "Código de vehículo incorrecto. Pídelo en recepción de tu taller.";
export const CLAIM_ERROR_REQUIRED =
  "Esta placa está registrada en un taller. Ingresa el código de este vehículo (te lo da recepción; no es el de Telegram).";
export const CLAIM_ERROR_RATE_LIMIT =
  "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
export const CLAIM_ERROR_MISSING_CODE =
  "Este vehículo aún no tiene código de reclamo. Pídelo en recepción para que lo generen.";

export function generateClaimCode(
  entropy: Uint8Array = randomBytes(CLAIM_CODE_LENGTH)
): string {
  let out = "";
  for (let i = 0; i < CLAIM_CODE_LENGTH; i++) {
    const byte = entropy[i % entropy.length] ?? 0;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

export function normalizeClaimCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function padded(code: string): Buffer {
  const slice = code.slice(0, CLAIM_CODE_LENGTH);
  return Buffer.from(slice.padEnd(CLAIM_CODE_LENGTH, "\0"), "utf8");
}

/** Comparación de tiempo constante. No revela si el código existe. */
export function claimCodesEqual(
  expected: string | null | undefined,
  provided: string | null | undefined
): boolean {
  const a = normalizeClaimCode(expected ?? "");
  const b = normalizeClaimCode(provided ?? "");
  const match = timingSafeEqual(padded(a), padded(b));
  return Boolean(expected) && Boolean(provided) && a.length === CLAIM_CODE_LENGTH && match;
}

export function checkClaimRateLimit(
  ip: string,
  userId: string,
  placa: string
): { ok: true } | { ok: false; retryAfterSec: number } {
  const byIp = checkRateLimit(`claim:ip:${ip}`, {
    windowMs: CLAIM_RATE_WINDOW_MS,
    max: CLAIM_RATE_MAX,
  });
  if (!byIp.ok) return byIp;
  return checkRateLimit(`claim:user:${userId}:${placa}`, {
    windowMs: CLAIM_RATE_WINDOW_MS,
    max: CLAIM_RATE_MAX,
  });
}

