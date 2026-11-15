import { cookies } from "next/headers";
import {
  PASSWORD_RECOVERY_COOKIE,
  passwordRecoveryCookieOptions,
} from "@/lib/auth/password-recovery";

export function markPasswordRecoverySession() {
  cookies().set(
    PASSWORD_RECOVERY_COOKIE,
    "1",
    passwordRecoveryCookieOptions()
  );
}

export function clearPasswordRecoverySession() {
  cookies().set(PASSWORD_RECOVERY_COOKIE, "", {
    ...passwordRecoveryCookieOptions(),
    maxAge: 0,
  });
}
