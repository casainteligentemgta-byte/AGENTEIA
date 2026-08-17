import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recordPortalLoginAction } from "@/app/actions/portal-login";
import {
  canonicalizeImportacionPath,
  IMPORTACION_BASE,
  isImportacionAppPath,
} from "@/lib/importacion/paths";

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
      const safeNext = isImportacionAppPath(next)
        ? canonicalizeImportacionPath(next)
        : next.startsWith("/") && !next.startsWith("//")
          ? next
          : "/portales";
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  const loginPath = isImportacionAppPath(next)
    ? `${IMPORTACION_BASE}/login?error=auth`
    : "/login?error=auth";
  return NextResponse.redirect(`${origin}${loginPath}`);
}
