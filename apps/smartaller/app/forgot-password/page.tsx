"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Car, Loader2, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { createClient } from "@/lib/supabase/client";
import {
  NEUTRAL_RESET_EMAIL_MESSAGE,
  RESEND_COOLDOWN_MS,
  buildResetPasswordPath,
  defaultRedirectForAccountType,
  forgotPasswordSchema,
  isAllowedAuthRedirect,
  isAuthRateLimit,
  mapAuthErrorMessage,
  type AccountType,
} from "@/lib/auth/password-recovery";
import { authEmailCallbackUrl } from "@/lib/app-url";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");

  const [accountType, setAccountType] = useState<AccountType>(() =>
    redirectParam?.startsWith("/app") ? "dueno" : "taller"
  );
  const [useAccountRedirect, setUseAccountRedirect] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) setCooldownUntil(null);
    }, 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const effectiveRedirect =
    !useAccountRedirect &&
    redirectParam &&
    isAllowedAuthRedirect(redirectParam)
      ? redirectParam
      : defaultRedirectForAccountType(accountType);

  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;
  const disabled = loading || cooldownSeconds > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setMessage({
        type: "error",
        text: parsed.error.issues[0]?.message ?? "Introduce un correo válido.",
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const nextPath = buildResetPasswordPath(effectiveRedirect);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: authEmailCallbackUrl(nextPath),
      });
      if (error && isAuthRateLimit(error)) {
        setMessage({
          type: "error",
          text: mapAuthErrorMessage(error),
        });
        setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      } else {
        setMessage({ type: "success", text: NEUTRAL_RESET_EMAIL_MESSAGE });
        setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        /Faltan NEXT_PUBLIC_SUPABASE/.test(err.message)
      ) {
        setMessage({
          type: "error",
          text: "Falta configurar Supabase Auth en las variables de entorno.",
        });
      } else {
        setMessage({ type: "success", text: NEUTRAL_RESET_EMAIL_MESSAGE });
        setCooldownUntil(Date.now() + RESEND_COOLDOWN_MS);
      }
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <BrandLogo size="md" theme="dark" showDot={false} />
        <p className="mt-3 text-sm text-zinc-500">
          Recupera el acceso a tu cuenta de taller o dueño.
        </p>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <h1 className="mb-1 text-lg font-semibold text-zinc-100">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Introduce tu correo y te enviaremos un enlace para elegir una nueva.
        </p>

        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Tipo de cuenta
        </p>
        <div className="mb-6 flex rounded-xl bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => {
              setAccountType("taller");
              setUseAccountRedirect(true);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
              accountType === "taller"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Wrench className="h-4 w-4" />
            Taller
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountType("dueno");
              setUseAccountRedirect(true);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
              accountType === "dueno"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Car className="h-4 w-4" />
            Dueño
          </button>
        </div>

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
            <label htmlFor="email" className="mb-1.5 block text-sm text-zinc-400">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-blue-500"
              placeholder="tu@taller.com"
            />
          </div>
          <button
            type="submit"
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {cooldownSeconds > 0
              ? `Reenviar en ${cooldownSeconds}s`
              : "Enviar enlace"}
          </button>
        </form>
      </div>

      <Link
        href={
          isAllowedAuthRedirect(effectiveRedirect)
            ? `/login?redirectTo=${encodeURIComponent(effectiveRedirect)}`
            : "/login"
        }
        className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio de sesión
      </Link>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-zinc-500">Cargando...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
