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
