"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Printer } from "lucide-react";

type Props = {
  vehiculoId: string;
};

type Mode = "download" | "print";

/** Descarga o imprime el PDF de carpeta física de desaduanamiento SENIAT. */
export function PuertoLibreDescargarDesaduanamientoPdf({ vehiculoId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);

  function run(next: Mode) {
    setError(null);
    setMode(next);
    startTransition(async () => {
      try {
        if (next === "print") {
          const opened = window.open(
            `/importacion/${vehiculoId}/desaduanamiento.pdf?inline=1`,
            "_blank",
            "noopener,noreferrer"
          );
          if (!opened) {
            setError("Permite ventanas emergentes para imprimir el PDF");
          }
          return;
        }

        const res = await fetch(
          `/importacion/${vehiculoId}/desaduanamiento.pdf`,
          { method: "GET", credentials: "same-origin" }
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
        const fileName = match?.[1] ?? "Expediente-SENIAT.pdf";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Error de red al generar el PDF");
      }
    });
  }

  const busy = pending;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => run("download")}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-3 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-600/60 hover:bg-cyan-950/70 disabled:opacity-60"
        >
          {busy && mode === "download" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {busy && mode === "download" ? "Generando…" : "Descargar PDF"}
        </button>
        <button
          type="button"
          onClick={() => run("print")}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
        >
          {busy && mode === "print" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Imprimir
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Expediente PDF SENIAT — portada, índice y documentos consignables.
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
