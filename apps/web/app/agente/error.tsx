"use client";

import { useEffect } from "react";

export default function AgenteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Agente]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-6 text-white">
      <h1 className="text-lg font-medium text-zinc-200">Error en el panel del agente</h1>
      <p className="max-w-md text-center text-sm text-zinc-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
      >
        Reintentar
      </button>
    </div>
  );
}
