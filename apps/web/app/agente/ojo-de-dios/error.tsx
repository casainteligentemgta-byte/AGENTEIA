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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#05080d] p-6 text-white">
      <h1 className="text-lg font-medium text-white">No se pudo cargar Ojo de Dios</h1>
      <p className="max-w-md text-center text-sm text-white/55">
        El panel personal no está disponible ahora. Puedes reintentar o volver al agente.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          Reintentar
        </button>
        <Link
          href="/agente"
          className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          Volver al panel
        </Link>
      </div>
    </div>
  );
}
