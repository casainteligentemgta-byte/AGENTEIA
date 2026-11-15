import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markPasswordRecoverySession } from "@/lib/auth/password-recovery-cookies";
import {
  isResetPasswordNext,
  resolveAuthRedirect,
} from "@/lib/auth/password-recovery";

/**
 * Intercambia token_hash del email (plantilla Reset Password) por sesión.
 * Recomendado para que el enlace funcione aunque se abra en otro dispositivo.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const errorCode = searchParams.get("error_code");

  const recoveryFallback = "/reset-password";
  const isRecovery = type === "recovery" || isResetPasswordNext(next ?? "");

  if (errorCode === "otp_expired" || searchParams.get("error") === "expired") {
    return NextResponse.redirect(`${origin}${recoveryFallback}?error=expired`);
  }

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      if (type === "recovery") {
        markPasswordRecoverySession();
      }
      const fallback = type === "recovery" ? recoveryFallback : "/portales";
      const safeNext = resolveAuthRedirect(next, fallback);
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  if (isRecovery) {
    const kind = errorCode === "otp_expired" ? "expired" : "invalid";
    return NextResponse.redirect(`${origin}${recoveryFallback}?error=${kind}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
