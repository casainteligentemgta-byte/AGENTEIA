"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, Wrench } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    errorParam === "auth"
      ? { type: "error", text: "No se pudo completar el inicio de sesión." }
      : errorParam === "config"
        ? { type: "error", text: "Falta configurar Supabase Auth en las variables de entorno." }
        : null
  );

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = redirectTo;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Cuenta creada. Revisa tu correo para confirmar o inicia sesión.",
        });
        setMode("login");
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error al autenticar",
      });
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: "google") => {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Error con Google",
      });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <Wrench className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SmartTaller</h1>
          <p className="text-sm text-zinc-500">Accede a tu panel de taller</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 sm:p-8">
        <div className="mb-6 flex rounded-xl bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "login" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "signup" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Crear cuenta
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

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-zinc-400">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-blue-500"
              placeholder="tu@taller.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-zinc-400">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Entrar al dashboard" : "Crear cuenta"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="text-xs text-zinc-600">o continúa con</span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
        >
          Continuar con Google
        </button>
      </div>

      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="text-zinc-500">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
