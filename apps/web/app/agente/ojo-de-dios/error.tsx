"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function OjoDeDiosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Ojo de Dios]", error.digest ?? "error");
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black p-6 text-white">
      <h1 className="text-lg font-medium text-zinc-200">No se pudo cargar Ojo de Dios</h1>
      <p className="max-w-md text-center text-sm text-zinc-500">
        El panel personal no está disponible ahora. Puedes reintentar o volver al agente.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
        >
          Reintentar
        </button>
        <Link
          href="/agente"
          className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
