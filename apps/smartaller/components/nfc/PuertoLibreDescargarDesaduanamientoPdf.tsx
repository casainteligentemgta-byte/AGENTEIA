"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Printer } from "lucide-react";

type Props = {
  vehiculoId: string;
  /** full = botón con texto; compact = barra estrecha. */
  variant?: "full" | "compact";
};

/** Descarga el PDF de carpeta física de desaduanamiento SENIAT. */
export function PuertoLibreDescargarDesaduanamientoPdf({
  vehiculoId,
  variant = "full",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/importacion/${vehiculoId}/desaduanamiento.pdf`,
          {
            method: "GET",
            credentials: "same-origin",
          }
        );
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
        const fileName = match?.[1] ?? "Desaduanamiento.pdf";
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={
          variant === "compact"
            ? "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-3 py-2.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-600/50 disabled:opacity-60"
            : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-800/50 bg-cyan-950/30 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-600/50 disabled:opacity-60 sm:w-auto"
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Printer className="h-4 w-4" />
            <Download className="h-4 w-4" />
          </>
        )}
        {pending
          ? "Generando carpeta PDF…"
          : "Descargar / imprimir carpeta PDF"}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
