"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

type Props = {
  vehiculoId: string;
  /** full = botón con texto; icon = cuadrado solo icono. */
  variant?: "full" | "icon";
};

/** Descarga el PDF completo del expediente (ruta autenticada). */
export function PuertoLibreDescargarPdf({
  vehiculoId,
  variant = "full",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/smartimport/${vehiculoId}/expediente.pdf`, {
          method: "GET",
          credentials: "same-origin",
        });
        if (!res.ok) {
          let message = "No se pudo generar el PDF";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) message = data.error;
          } catch {
            /* ignore */
          }
          setError(message);
          return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = /filename="([^"]+)"/i.exec(disposition);
        const fileName = match?.[1] ?? "Expediente.pdf";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Error de red al descargar el PDF");
      }
    });
  }

  if (variant === "icon") {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          aria-label={pending ? "Generando PDF…" : "Descargar PDF del expediente"}
          title="Descargar PDF"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950/40 text-zinc-200 transition hover:border-cyan-700/50 hover:text-cyan-100 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </button>
        {error ? (
          <p className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-red-900/50 bg-red-950 px-2 py-1.5 text-[11px] leading-snug text-red-200 shadow-lg">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/40 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-700/50 hover:text-cyan-100 disabled:opacity-60 sm:w-auto"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {pending ? "Generando PDF…" : "Descargar PDF del expediente"}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
