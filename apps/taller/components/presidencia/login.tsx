"use client";

import { useState, useTransition } from "react";
import { verificarPinPresidencia } from "@/app/actions/presidencia";

export function PresidenciaLogin() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const pin = new FormData(form).get("pin") as string;

    startTransition(async () => {
      const result = await verificarPinPresidencia(pin);
      if (!result.ok) {
        setError(result.error ?? "PIN incorrecto");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">Acceso presidencia</h1>
      <p className="mt-2 text-sm text-slate-500">Ingresa el PIN del taller para ver el panel.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="pin" className="block text-sm font-medium text-slate-700">
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
