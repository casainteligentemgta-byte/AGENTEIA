"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isStaleChunkError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|o\[e\]\.call|undefined is not an object \(evaluating ['\"]o\[/i.test(
    msg
  );
}

export default function DashboardError({ error, reset }: Props) {
  const stale = isStaleChunkError(error);

  useEffect(() => {
    console.error("[dashboard]", error?.message, error?.digest, error);
  }, [error]);

  useEffect(() => {
    if (!stale || typeof window === "undefined") return;
    const key = "st-chunk-reload-v1";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    } catch {
      // ignore
    }
  }, [stale]);

  function hardReload() {
    try {
      sessionStorage.removeItem("st-chunk-reload-v1");
    } catch {
      // ignore
    }
    window.location.href = window.location.href.split("#")[0] ?? "/dashboard";
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {stale
          ? "Hay una versión nueva de la app. Recarga la página para continuar."
          : "No se pudo cargar esta pantalla del taller. Prueba de nuevo o vuelve al listado."}
      </p>
      {error.message && process.env.NODE_ENV !== "production" && (
        <p className="mt-2 max-w-lg break-words text-xs text-red-400">
          {error.message}
        </p>
      )}
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-zinc-600">
          Digest: {error.digest}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={stale ? hardReload : reset}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          {stale ? "Recargar app" : "Reintentar"}
        </button>
        <Link
          href="/dashboard/vehiculos"
          className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-500"
        >
          Ir a vehículos
        </Link>
      </div>
    </div>
  );
}
