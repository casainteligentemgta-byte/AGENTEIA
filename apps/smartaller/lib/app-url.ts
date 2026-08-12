/** Dominio de producción de SmartTaller. */
export const PRODUCTION_APP_HOST = "smarttaller.xyz";
export const PRODUCTION_APP_URL = `https://${PRODUCTION_APP_HOST}`;

function normalizePublicUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^https?:\/\//i, "")}`;
}

function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

function isDeployedRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.VERCEL_ENV)
  );
}

/**
 * URL base pública (links WhatsApp, OpenRouter Referer, Stripe, portal, NFC).
 * En runtime desplegado nunca devuelve localhost aunque NEXT_PUBLIC_APP_URL esté mal.
 */
export function getAppBaseUrl(): string {
  const deployed = isDeployedRuntime();
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (fromEnv) {
    const normalized = normalizePublicUrl(fromEnv);
    if (!deployed || !isLocalhostUrl(normalized)) {
      return normalized;
    }
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost && !isLocalhostUrl(`https://${productionHost}`)) {
    return normalizePublicUrl(productionHost);
  }

  if (deployed) return PRODUCTION_APP_URL;

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
