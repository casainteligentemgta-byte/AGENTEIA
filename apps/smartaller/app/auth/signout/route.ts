import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { clearPasswordRecoverySession } from "@/lib/auth/password-recovery-cookies";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearPasswordRecoverySession();
  return NextResponse.redirect(new URL("/login", request.url));
}
