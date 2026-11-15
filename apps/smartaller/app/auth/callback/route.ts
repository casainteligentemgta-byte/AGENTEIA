import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { recordPortalLoginAction } from "@/app/actions/portal-login";
import { markPasswordRecoverySession } from "@/lib/auth/password-recovery-cookies";
import {
  isResetPasswordNext,
  resolveAuthRedirect,
} from "@/lib/auth/password-recovery";
import {
  IMPORTACION_BASE,
  isImportacionAppPath,
} from "@/lib/importacion/paths";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portales";
  const logLogin = searchParams.get("logLogin") === "1";
  const errorCode = searchParams.get("error_code");
  const errorParam = searchParams.get("error");
  const recoveryFlow = isResetPasswordNext(next);

  if (errorCode === "otp_expired" || errorParam === "expired") {
    return NextResponse.redirect(`${origin}/reset-password?error=expired`);
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (recoveryFlow) {
        markPasswordRecoverySession();
      } else if (logLogin) {
        await recordPortalLoginAction(next);
      }
      const safeNext = resolveAuthRedirect(next, recoveryFlow ? "/reset-password" : "/portales");
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
    if (recoveryFlow) {
      return NextResponse.redirect(`${origin}/reset-password?error=invalid`);
    }
  }

  if (recoveryFlow || errorCode === "otp_expired") {
    const kind = errorCode === "otp_expired" ? "expired" : "invalid";
    return NextResponse.redirect(`${origin}/reset-password?error=${kind}`);
  }

  const loginPath = isImportacionAppPath(next)
    ? `${IMPORTACION_BASE}/login?error=auth`
    : "/login?error=auth";
  return NextResponse.redirect(`${origin}${loginPath}`);
}
