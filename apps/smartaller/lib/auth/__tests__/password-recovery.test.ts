import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildResetPasswordPath,
  defaultRedirectForAccountType,
  forgotPasswordHref,
  forgotPasswordSchema,
  googleAuthErrorMessage,
  isGoogleAuthEnabled,
  isAllowedAuthRedirect,
  isResetEmailRateLimit,
  isResetPasswordNext,
  pathnameOf,
  recoveryRedirectPath,
  resetPasswordSchema,
  resolveAuthRedirect,
} from "../password-recovery";

describe("password-recovery helpers", () => {
  it("elige el portal según tipo de cuenta (igual que /login)", () => {
    assert.equal(defaultRedirectForAccountType("dueno"), "/app");
    assert.equal(defaultRedirectForAccountType("taller"), "/portales");
  });

  it("detecta next de reset aunque traiga query", () => {
    assert.equal(isResetPasswordNext("/reset-password"), true);
    assert.equal(
      isResetPasswordNext("/reset-password?redirectTo=/app"),
      true
    );
    assert.equal(isResetPasswordNext("/portales"), false);
    assert.equal(pathnameOf("/reset-password?redirectTo=/app#x"), "/reset-password");
  });

  it("sanitiza redirectTo y construye rutas", () => {
    assert.equal(isAllowedAuthRedirect("/app"), true);
    assert.equal(isAllowedAuthRedirect("/dashboard"), true);
    assert.equal(isAllowedAuthRedirect("/portales/master"), true);
    assert.equal(isAllowedAuthRedirect("https://evil.example"), false);
    assert.equal(isAllowedAuthRedirect("//evil.example"), false);
    assert.equal(buildResetPasswordPath("/app"), "/reset-password?redirectTo=%2Fapp");
    assert.equal(buildResetPasswordPath("/nope"), "/reset-password");
    assert.equal(
      forgotPasswordHref("/portales"),
      "/forgot-password?redirectTo=%2Fportales"
    );
  });

  it("resuelve next del callback como la ruta existente", () => {
    assert.equal(resolveAuthRedirect("/app", "/portales"), "/app");
    assert.equal(resolveAuthRedirect("//evil", "/portales"), "/portales");
    assert.equal(resolveAuthRedirect("https://x", "/portales"), "/portales");
    assert.equal(resolveAuthRedirect(null, "/reset-password"), "/reset-password");
  });

  it("no deja que una sesión de recovery entre al portal", () => {
    assert.equal(
      recoveryRedirectPath({
        pathname: "/portales",
        hasRecoveryCookie: true,
      }),
      "/reset-password"
    );
    assert.equal(
      recoveryRedirectPath({ pathname: "/login", hasRecoveryCookie: true }),
      "/reset-password"
    );
    assert.equal(
      recoveryRedirectPath({
        pathname: "/reset-password",
        hasRecoveryCookie: true,
      }),
      null
    );
    assert.equal(
      recoveryRedirectPath({
        pathname: "/auth/callback",
        hasRecoveryCookie: true,
      }),
      null
    );
    assert.equal(
      recoveryRedirectPath({ pathname: "/app", hasRecoveryCookie: false }),
      null
    );
  });

  it("valida email y contraseñas", () => {
    assert.equal(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success, true);
    assert.equal(forgotPasswordSchema.safeParse({ email: "nope" }).success, false);
    assert.equal(
      resetPasswordSchema.safeParse({
        password: "123456",
        confirmPassword: "123456",
      }).success,
      true
    );
    assert.equal(
      resetPasswordSchema.safeParse({
        password: "12345",
        confirmPassword: "12345",
      }).success,
      false
    );
    assert.equal(
      resetPasswordSchema.safeParse({
        password: "123456",
        confirmPassword: "654321",
      }).success,
      false
    );
  });

  it("traduce el error de Google deshabilitado y detecta rate limit", () => {
    assert.match(
      googleAuthErrorMessage("Unsupported provider: provider is not enabled"),
      /no está disponible/
    );
    assert.equal(googleAuthErrorMessage("network"), "network");
    assert.equal(
      isResetEmailRateLimit(
        "For security purposes, you can only request this after 60 seconds."
      ),
      true
    );
    assert.equal(isResetEmailRateLimit("over_email_send_rate_limit"), true);
    assert.equal(isResetEmailRateLimit("Too many requests"), true);
  });

  it("Google queda oculto salvo NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", () => {
    const prev = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED;
    delete process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED;
    assert.equal(isGoogleAuthEnabled(), false);
    process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED = "1";
    assert.equal(isGoogleAuthEnabled(), true);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED;
    else process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED = prev;
  });
});
