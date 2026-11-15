import { z } from "zod";
import {
  canonicalizeImportacionPath,
  isImportacionAppPath,
} from "@/lib/importacion/paths";

export const PASSWORD_RECOVERY_COOKIE = "st-password-recovery";
export const MIN_PASSWORD_LENGTH = 6;
export const RESEND_COOLDOWN_MS = 60_000;

export const NEUTRAL_RESET_EMAIL_MESSAGE =
  "Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.";

export const RESET_LINK_INVALID_MESSAGE =
  "Este enlace no es válido o ya se usó. Solicita uno nuevo para restablecer tu contraseña.";

export const RESET_LINK_EXPIRED_MESSAGE =
  "Este enlace caducó. Solicita uno nuevo para restablecer tu contraseña.";

export const SAME_PASSWORD_MESSAGE =
  "La nueva contraseña debe ser distinta a la anterior.";

export const INVALID_CREDENTIALS_MESSAGE =
  "Correo o contraseña incorrectos.";

export const WEAK_PASSWORD_MESSAGE =
  "La contraseña es demasiado débil. Elige una más segura.";

export const AUTH_RATE_LIMIT_MESSAGE =
  "Demasiados intentos. Espera un minuto e inténtalo de nuevo.";

export const EMAIL_NOT_CONFIRMED_MESSAGE =
  "Confirma tu correo antes de iniciar sesión.";

export const USER_ALREADY_REGISTERED_MESSAGE =
  "Ya existe una cuenta con este correo. Inicia sesión o recupera la contraseña.";

export const CANCEL_PASSWORD_RECOVERY_LABEL =
  "Cancelar y volver al inicio de sesión";

export type AccountType = "taller" | "dueno";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Introduce un correo válido.")
    .max(254),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export function passwordRecoveryCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  };
}

export function hasPasswordRecoveryCookie(
  cookieStore: { get(name: string): { value: string } | undefined }
): boolean {
  return cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value === "1";
}

export function defaultRedirectForAccountType(accountType: AccountType): string {
  return accountType === "dueno" ? "/app" : "/portales";
}

export function isPasswordRecoveryPath(pathname: string): boolean {
  return pathname === "/forgot-password" || pathname === "/reset-password";
}

export function pathnameOf(pathWithSearch: string): string {
  const withoutHash = pathWithSearch.split("#")[0] ?? pathWithSearch;
  return withoutHash.split("?")[0] ?? withoutHash;
}

export function isResetPasswordNext(next: string): boolean {
  return pathnameOf(next) === "/reset-password";
}

/** Destinos permitidos tras login / reset (misma regla que el middleware). */
export function isAllowedAuthRedirect(redirectTo: string): boolean {
  return (
    redirectTo.startsWith("/dashboard") ||
    redirectTo.startsWith("/app") ||
    isImportacionAppPath(redirectTo) ||
    redirectTo.startsWith("/portales")
  );
}

/**
 * Sanitiza `next` del callback OAuth/recovery. Misma regla que `/auth/callback`.
 */
export function resolveAuthRedirect(
  next: string | null | undefined,
  fallback: string
): string {
  if (!next) return fallback;
  if (isImportacionAppPath(next)) {
    return canonicalizeImportacionPath(next);
  }
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return fallback;
}

export function buildResetPasswordPath(redirectTo: string | null): string {
  if (redirectTo && isAllowedAuthRedirect(redirectTo)) {
    return `/reset-password?redirectTo=${encodeURIComponent(redirectTo)}`;
  }
  return "/reset-password";
}

export function forgotPasswordHref(redirectTo: string): string {
  if (isAllowedAuthRedirect(redirectTo)) {
    return `/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}`;
  }
  return "/forgot-password";
}

export function isGoogleAuthEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function googleAuthErrorMessage(raw: string): string {
  if (/unsupported provider|provider is not enabled/i.test(raw)) {
    return "El inicio de sesión con Google no está disponible por ahora. Usa correo y contraseña.";
  }
  return raw;
}

export function isResetEmailRateLimit(message: string): boolean {
  return /rate limit|too many|over_email_send_rate_limit|only request this after/i.test(
    message
  );
}

function authErrorParts(error: unknown): { code: string; message: string } {
  if (typeof error === "string") {
    return { code: "", message: error };
  }
  if (error && typeof error === "object") {
    const rec = error as { code?: unknown; message?: unknown };
    return {
      code: typeof rec.code === "string" ? rec.code.toLowerCase() : "",
      message: typeof rec.message === "string" ? rec.message : "",
    };
  }
  return { code: "", message: "" };
}

export function isAuthRateLimit(error: unknown): boolean {
  const { code, message } = authErrorParts(error);
  return (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "over_sms_send_rate_limit" ||
    isResetEmailRateLimit(message)
  );
}

/**
 * Traduce errores habituales de Supabase Auth (login, signup, reset).
 * Si no hay mapeo, deja el mensaje original o el fallback.
 */
export function mapAuthErrorMessage(
  error: unknown,
  fallback = "No se pudo completar la operación."
): string {
  const { code, message } = authErrorParts(error);
  const text = message.toLowerCase();

  if (
    code === "same_password" ||
    /new password should be different from the old password/.test(text)
  ) {
    return SAME_PASSWORD_MESSAGE;
  }
  if (
    code === "invalid_credentials" ||
    /invalid login credentials|invalid credentials/.test(text)
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (
    code === "weak_password" ||
    /password should be at least|password is known to be weak|weak password/.test(
      text
    )
  ) {
    return WEAK_PASSWORD_MESSAGE;
  }
  if (isAuthRateLimit(error)) {
    return AUTH_RATE_LIMIT_MESSAGE;
  }
  if (code === "email_not_confirmed" || /email not confirmed/.test(text)) {
    return EMAIL_NOT_CONFIRMED_MESSAGE;
  }
  if (
    code === "user_already_registered" ||
    code === "user_already_exists" ||
    /user already registered|already been registered/.test(text)
  ) {
    return USER_ALREADY_REGISTERED_MESSAGE;
  }

  const trimmed = message.trim();
  return trimmed || fallback;
}

export function recoveryRedirectPath(args: {
  pathname: string;
  hasRecoveryCookie: boolean;
}): string | null {
  if (!args.hasRecoveryCookie) return null;
  if (isPasswordRecoveryPath(args.pathname)) return null;
  if (args.pathname.startsWith("/auth/")) return null;
  if (
    args.pathname === "/login" ||
    args.pathname.startsWith("/dashboard") ||
    args.pathname.startsWith("/app") ||
    isImportacionAppPath(args.pathname) ||
    args.pathname.startsWith("/portales")
  ) {
    return "/reset-password";
  }
  return null;
}
