"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/app/brand-logo";
import { createClient } from "@/lib/supabase/client";
import { recordPortalLoginAction } from "@/app/actions/portal-login";
import { canonicalizeImportacionPath, IMPORTACION_BASE, isImportacionAppPath } from "@/lib/importacion/paths";

function ImportacionLoginForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirectTo");
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(
    errorParam === "auth"
      ? { type: "error", text: "No se pudo completar el inicio de sesión." }
      : errorParam === "config"
        ? {
            type: "error",
            text: "Falta configurar Supabase Auth en las variables de entorno.",
          }
        : null
  );

  const effectiveRedirect =
    redirectParam && isImportacionAppPath(redirectParam)
      ? canonicalizeImportacionPath(redirectParam)
      : IMPORTACION_BASE;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await recordPortalLoginAction(effectiveRedirect);
        window.location.href = effectiveRedirect;
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
        text: err instanceof Error ? err.message : "Error con Google",
      });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <BrandLogo size="md" theme="dark" showDot={false} />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-50">
          Importación
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Expedientes, desaduanamiento y nacionalización. Entra con tu correo.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 p-6 sm:p-8">
        <div className="mb-6 flex rounded-xl bg-zinc-900 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "login"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "signup"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Correo
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Contraseña
            </label>
            <input
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-cyan-500/40 focus:ring-2"
            />
          </div>

          {message ? (
            <p
              className={`text-sm ${
                message.type === "error" ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {message.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "login" ? "Entrar a Importación" : "Crear cuenta"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-zinc-600">
          <div className="h-px flex-1 bg-zinc-800" />
          o
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <button
          type="button"
          onClick={handleOAuth}
          disabled={loading}
          className="w-full rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 disabled:opacity-60"
        >
          Continuar con Google
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">
        App independiente de importación Puerto Libre.
      </p>
    </div>
  );
}

export default function ImportacionLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(8,145,178,0.14),_transparent_50%),linear-gradient(180deg,#070b12_0%,#0a1628_45%,#070b12_100%)] px-4 py-10">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        }
      >
        <ImportacionLoginForm />
      </Suspense>
    </main>
  );
}
