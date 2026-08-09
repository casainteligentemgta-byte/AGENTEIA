import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recordPortalLoginAction } from "@/app/actions/portal-login";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portales";
  const logLogin = searchParams.get("logLogin") === "1";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (logLogin) {
        await recordPortalLoginAction(next);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const loginPath = next.startsWith("/importacion")
    ? "/importacion/login?error=auth"
    : "/login?error=auth";
  return NextResponse.redirect(`${origin}${loginPath}`);
}
