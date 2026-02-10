"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-950 p-6 text-neutral-100">
      <h1 className="text-lg font-medium text-neutral-200">Algo ha fallado</h1>
      <p className="max-w-md text-center text-sm text-neutral-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
      >
        Reintentar
      </button>
    </div>
  );
}
