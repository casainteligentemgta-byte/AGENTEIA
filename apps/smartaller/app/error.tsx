"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
      >
        Reintentar
      </button>
    </div>
  );
}
