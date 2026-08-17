import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recordPortalLoginAction } from "@/app/actions/portal-login";
import { IMPORTACION_BASE } from "@/lib/importacion/paths";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? IMPORTACION_BASE;
  const logLogin = searchParams.get("logLogin") === "1";
  const loginPath = `${IMPORTACION_BASE}/login?error=auth`;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (logLogin) {
        await recordPortalLoginAction(next);
      }
      const safeNext =
        next === IMPORTACION_BASE || next.startsWith(`${IMPORTACION_BASE}/`)
          ? next
          : IMPORTACION_BASE;
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}${loginPath}`);
}
