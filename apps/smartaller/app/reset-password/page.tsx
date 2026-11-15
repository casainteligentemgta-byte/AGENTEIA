"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { createClient } from "@/lib/supabase/client";
import { recordPortalLoginAction } from "@/app/actions/portal-login";
import { clearPasswordRecoveryCookieAction } from "@/app/actions/password-recovery";
import {
  CANCEL_PASSWORD_RECOVERY_LABEL,
  MIN_PASSWORD_LENGTH,
  RESET_LINK_EXPIRED_MESSAGE,
  RESET_LINK_INVALID_MESSAGE,
  defaultRedirectForAccountType,
  forgotPasswordHref,
  isAllowedAuthRedirect,
  mapAuthErrorMessage,
  resetPasswordSchema,
} from "@/lib/auth/password-recovery";

type Status = "checking" | "ready" | "invalid" | "expired";

function errorStatusFromParams(searchParams: URLSearchParams): Status | null {
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  if (error === "expired" || errorCode === "otp_expired") return "expired";
  if (error === "invalid" || error === "access_denied" || errorCode) {
    return "invalid";
  }
  return null;
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const initialError = errorStatusFromParams(searchParams);

  const [status, setStatus] = useState<Status>(initialError ?? "checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const effectiveRedirect =
    redirectParam && isAllowedAuthRedirect(redirectParam)
      ? redirectParam
      : defaultRedirectForAccountType("taller");

  useEffect(() => {
    if (initialError) return;

    let cancelled = false;
    const supabase = createClient();
    let timeoutId: number | undefined;

    const markReady = () => {
      if (!cancelled) setStatus("ready");
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        markReady();
      }
    });

    async function init() {
      try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = errorStatusFromParams(params);
        if (fromQuery) {
          if (!cancelled) setStatus(fromQuery);
          return;
        }

        const hashParams = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        if (accessToken && (type === "recovery" || refreshToken)) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken ?? "",
          });
          if (!error) {
            markReady();
            window.history.replaceState(
              {},
              document.title,
              `${window.location.pathname}${window.location.search}`
            );
            return;
          }
        }

        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            markReady();
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete("code");
            window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search);
            return;
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          markReady();
          return;
        }

        timeoutId = window.setTimeout(() => {
          if (!cancelled) setStatus("invalid");
        }, 2500);
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    }

    void init();

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [initialError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setMessage({
        type: "error",
        text: parsed.error.issues[0]?.message ?? "Revisa la contraseña.",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });
      if (error) throw error;
      await clearPasswordRecoveryCookieAction();
      await recordPortalLoginAction(effectiveRedirect);
      window.location.href = effectiveRedirect;
    } catch (err) {
      setMessage({
        type: "error",
        text: mapAuthErrorMessage(err, "No se pudo actualizar la contraseña."),
      });
      setLoading(false);
    }
  };

  const invalidHref = forgotPasswordHref(
    redirectParam && isAllowedAuthRedirect(redirectParam)
      ? redirectParam
      : effectiveRedirect
  );

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <BrandLogo size="md" theme="dark" showDot={false} />
        <p className="mt-3 text-sm text-zinc-500">Elige una nueva contraseña.</p>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        {status === "checking" && (
          <p className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comprobando el enlace…
          </p>
        )}

        {(status === "invalid" || status === "expired") && (
          <div className="space-y-4">
            <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {status === "expired"
                ? RESET_LINK_EXPIRED_MESSAGE
                : RESET_LINK_INVALID_MESSAGE}
            </p>
            <Link
              href={invalidHref}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
            >
              Solicitar un enlace nuevo
            </Link>
          </div>
        )}

        {status === "ready" && (
          <>
            <h1 className="mb-6 text-lg font-semibold text-zinc-100">
              Nueva contraseña
            </h1>
            {message && (
              <p
                className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                  message.type === "error"
                    ? "border-red-900/50 bg-red-950/30 text-red-200"
                    : "border-emerald-900/50 bg-emerald-950/30 text-emerald-200"
                }`}
              >
                {message.text}
              </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm text-zinc-400"
                >
                  Contraseña nueva
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm text-zinc-400"
                >
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Mínimo {MIN_PASSWORD_LENGTH} caracteres.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar e entrar
              </button>
            </form>
          </>
        )}
      </div>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {CANCEL_PASSWORD_RECOVERY_LABEL}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-zinc-500">Cargando...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
