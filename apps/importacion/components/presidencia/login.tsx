"use client";

import { useState, useTransition } from "react";
import { verificarPinPresidencia } from "@/app/actions/presidencia";

type Props = {
  tallerId: string;
};

export function PresidenciaLogin({ tallerId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const pin = new FormData(e.currentTarget).get("pin") as string;

    startTransition(async () => {
      const result = await verificarPinPresidencia(pin, tallerId);
      if (!result.ok) {
        setError(result.error ?? "PIN incorrecto");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="glass mx-auto max-w-sm rounded-2xl p-8">
      <h1 className="text-xl font-bold text-zinc-100">Acceso presidencia</h1>
      <p className="mt-2 text-sm text-zinc-500">Ingresa el PIN del taller para ver el panel en recepción.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="pin" className="block text-sm font-medium text-zinc-300">
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {pending ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
