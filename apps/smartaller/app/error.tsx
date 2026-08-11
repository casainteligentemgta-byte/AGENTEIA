"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isStaleChunkError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|o\[e\]\.call|undefined is not an object \(evaluating ['\"]o\[/i.test(
    msg
  );
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const stale = isStaleChunkError(error);

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
    window.location.href = window.location.href.split("#")[0] ?? "/";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {stale
          ? "Hay una versión nueva de la app. Recarga la página para continuar."
          : error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={stale ? hardReload : reset}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          {stale ? "Recargar app" : "Reintentar"}
        </button>
        {!stale ? (
          <button
            type="button"
            onClick={hardReload}
            className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-500"
          >
            Recargar página
          </button>
        ) : null}
      </div>
    </div>
  );
}
