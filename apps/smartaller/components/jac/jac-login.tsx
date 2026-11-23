"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { recordPortalLoginAction } from "@/app/actions/portal-login";
import {
  forgotPasswordHref,
  googleAuthErrorMessage,
  isGoogleAuthEnabled,
} from "@/lib/auth/password-recovery";
import { authEmailCallbackUrl } from "@/lib/app-url";
import Image from "next/image";
import { getBrand } from "@/lib/brand";
import { JAC_LOGIN_HERO_PHOTO } from "@/lib/brand/jac-photos";
import { JacCarPhoto } from "@/components/jac/jac-car-photo";

type AccountType = "taller" | "dueno";

function JacLoginForm() {
  const brand = getBrand();
  const copy = brand.copy.loginScreen;
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const errorParam = searchParams.get("error");
  const modeParam = searchParams.get("mode");

  const [accountType, setAccountType] = useState<AccountType>(() =>
    redirectParam?.startsWith("/app") ? "dueno" : "dueno"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">(
    modeParam === "signup" ? "signup" : "login"
  );
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    errorParam
      ? { type: "error", text: copy.authError }
      : null
  );

  const effectiveRedirect =
    redirectParam ?? (accountType === "dueno" ? "/app" : "/portales");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await recordPortalLoginAction(effectiveRedirect);
        window.location.href = effectiveRedirect;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: authEmailCallbackUrl(effectiveRedirect) },
        });
        if (error) throw error;
        setMessage({ type: "success", text: copy.signupSuccess });
        setMode("login");
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : copy.authError,
      });
    }
    setLoading(false);
  };

  const handleOAuth = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(effectiveRedirect)}&logLogin=1`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({
        type: "error",
        text: googleAuthErrorMessage(
          err instanceof Error ? err.message : copy.authError
        ),
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#f3f4f8] text-[#1c1c22]">
      <div className="relative min-h-[240px] w-full flex-1 overflow-hidden">
        <JacCarPhoto
          src={JAC_LOGIN_HERO_PHOTO}
          alt="JAC Tepuy Pro"
          className="object-cover object-[50%_40%]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-[#f3f4f8]" />
        <Image
          src={brand.assets.logoOnDark}
          alt={brand.copy.name}
          width={140}
          height={32}
          className="absolute left-5 top-[max(1.25rem,env(safe-area-inset-top))] h-8 w-auto"
        />
      </div>

      <div className="relative z-10 -mt-8 rounded-t-[28px] bg-[#f3f4f8] px-5 pb-10 pt-6">
        <h1 className="jac-title text-[28px] leading-tight text-[#1c1c22]">{copy.title}</h1>
        <p className="mt-2 text-[15px] leading-snug text-[#5b5b66]">{copy.subtitle}</p>

        <div className="jac-pill mt-5">
          <button
            type="button"
            data-active={accountType === "dueno"}
            onClick={() => setAccountType("dueno")}
          >
            {copy.ownerTab}
          </button>
          <button
            type="button"
            data-active={accountType === "taller"}
            onClick={() => setAccountType("taller")}
          >
            {copy.workshopTab}
          </button>
        </div>

        {message && (
          <p
            className={`mt-4 rounded-[18px] px-4 py-3 text-sm ${
              message.type === "error" ? "jac-alert" : "bg-[#e6f6ec] text-[#1f8a4c]"
            }`}
          >
            {message.text}
          </p>
        )}

        <form onSubmit={handleEmailAuth} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#6a6a74]">
              {copy.emailLabel}
            </span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa3]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="jac-input"
                autoComplete="email"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-[#6a6a74]">
              {copy.passwordLabel}
            </span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa3]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="jac-input"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </span>
          </label>

          {mode === "login" && (
            <div className="text-right">
              <Link
                href={forgotPasswordHref(effectiveRedirect)}
                className="text-[13px] font-medium text-[#5b5b66]"
              >
                {copy.forgot}
              </Link>
            </div>
          )}

          <button type="submit" disabled={loading} className="jac-btn mt-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? copy.submit : copy.signup}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="mt-4 w-full text-center text-[14px] font-semibold text-[#1c1c22]"
        >
          {mode === "login" ? copy.signup : copy.signin}
        </button>

        {isGoogleAuthEnabled() && (
          <button
            type="button"
            onClick={handleOAuth}
            disabled={loading}
            className="mt-4 flex h-[52px] w-full items-center justify-center rounded-2xl border border-[#e6e7ee] bg-white text-[14px] font-semibold"
          >
            {copy.google}
          </button>
        )}
      </div>
    </div>
  );
}

export function JacLogin() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f3f4f8]" />}>
      <JacLoginForm />
    </Suspense>
  );
}
