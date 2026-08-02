"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";

type Props = {
  vehiculoId: string;
  /** Variante visual: botón primario o secundario. */
  variant?: "primary" | "secondary";
};

/** Descarga el PDF completo del expediente (ruta autenticada). */
export function PuertoLibreDescargarPdf({
  vehiculoId,
  variant = "secondary",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/puerto-libre/${vehiculoId}/expediente.pdf`, {
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

  const styles =
    variant === "primary"
      ? "bg-cyan-600 text-white hover:bg-cyan-500"
      : "border border-zinc-700 bg-zinc-950/40 text-zinc-200 hover:border-cyan-700/50 hover:text-cyan-100";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition disabled:opacity-60 sm:w-auto ${styles}`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {pending ? "Generando PDF…" : "Descargar PDF del expediente"}
      </button>
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
