/** Dominio de producción de SmartTaller. */
export const PRODUCTION_APP_HOST = "smarttaller.xyz";
export const PRODUCTION_APP_URL = `https://${PRODUCTION_APP_HOST}`;

function normalizePublicUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
}

/** URL base pública (links WhatsApp, OpenRouter Referer, Stripe, portal cliente). */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return normalizePublicUrl(fromEnv);
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NODE_ENV === "production") return PRODUCTION_APP_URL;
  return "http://localhost:3003";
}

/** Host para mostrar en PDFs, emails y footers. */
export function getAppHost(): string {
  try {
    return new URL(getAppBaseUrl()).host;
  } catch {
    return PRODUCTION_APP_HOST;
  }
}
