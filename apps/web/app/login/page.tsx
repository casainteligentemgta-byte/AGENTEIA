"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/agente";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
        setLoading(false);
        return;
      }
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Error al iniciar sesión",
      });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/90 p-8 shadow-xl">
        <Link
          href="/agente"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Elige un proveedor para acceder a tu agente.
        </p>

        {message && (
          <p
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              message.type === "error"
                ? "border-red-900/50 bg-red-950/30 text-red-200"
                : "border-emerald-900/50 bg-emerald-950/30 text-emerald-200"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-700/80 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Continuar con Google"
            )}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth("github")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-700/80 disabled:opacity-50"
          >
            Continuar con GitHub
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Tras iniciar sesión serás redirigido a tu agente.
        </p>
      </div>
    </div>
  );
}
