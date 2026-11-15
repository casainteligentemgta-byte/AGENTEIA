"use server";

import { clearPasswordRecoverySession } from "@/lib/auth/password-recovery-cookies";

export async function clearPasswordRecoveryCookieAction(): Promise<void> {
  clearPasswordRecoverySession();
}
