import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { clearPasswordRecoverySession } from "@/lib/auth/password-recovery-cookies";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearPasswordRecoverySession();
  // 303: el POST del formulario de cancelar recovery no se reenvía a /login.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
