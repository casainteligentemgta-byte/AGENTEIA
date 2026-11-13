export type HealthStatus = "ok" | "error" | "skipped";

export type HealthChecks = {
  supabase: HealthStatus;
  openai: HealthStatus;
  gemini: HealthStatus;
  telegram: HealthStatus;
  telegram_webhook_secret: HealthStatus;
  cron: HealthStatus;
  stripe: HealthStatus;
};

export function isDetailedHealthAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function envFlagStatus(value: string | undefined): HealthStatus {
  return value?.trim() ? "ok" : "skipped";
}

/**
 * El webhook de Telegram responde 503 en producción sin TELEGRAM_WEBHOOK_SECRET.
 * No marcar telegram como ok si el secret falta.
 */
export function telegramIntegrationStatus(): HealthStatus {
  const token = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const secret = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET?.trim());
  if (!token) return "skipped";
  return secret ? "ok" : "error";
}

export function telegramWebhookSecretStatus(): HealthStatus {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ? "ok" : "error";
}

export function publicHealthPayload(healthy: boolean): { status: "ok" | "fail" } {
  return { status: healthy ? "ok" : "fail" };
}
