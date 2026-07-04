import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error" | "skipped"> = {
    supabase: "skipped",
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

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "smartaller",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
