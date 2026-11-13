import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  envFlagStatus,
  isDetailedHealthAuthorized,
  publicHealthPayload,
  telegramIntegrationStatus,
  telegramWebhookSecretStatus,
  type HealthChecks,
} from "@/lib/api/health";

export const dynamic = "force-dynamic";

async function runChecks(): Promise<{ healthy: boolean; checks: HealthChecks }> {
  const checks: HealthChecks = {
    supabase: "skipped",
    openai: envFlagStatus(process.env.OPENAI_API_KEY),
    gemini: envFlagStatus(process.env.GEMINI_API_KEY),
    telegram: telegramIntegrationStatus(),
    telegram_webhook_secret: telegramWebhookSecretStatus(),
    cron: envFlagStatus(process.env.CRON_SECRET),
    stripe: envFlagStatus(process.env.STRIPE_SECRET_KEY),
  };

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("talleres").select("id", { head: true, count: "exact" });
      checks.supabase = error ? "error" : "ok";
    } catch {
      checks.supabase = "error";
    }
  }

  const healthy = Object.values(checks).every((v) => v !== "error");
  return { healthy, checks };
}

export async function GET(req: Request) {
  const { healthy, checks } = await runChecks();
  const status = healthy ? 200 : 503;

  if (!isDetailedHealthAuthorized(req)) {
    return NextResponse.json(publicHealthPayload(healthy), { status });
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "smartaller",
      env: process.env.VERCEL_ENV ?? "local",
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  );
}
