"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deletePuertoLibreVehiculoAction } from "@/app/actions/nfc/puerto-libre-vehiculo";

type Props = {
  vehiculoId: string;
  codigo: string;
  /** section = bloque en ficha; icon = botón compacto en listas */
  variant?: "section" | "icon";
};

export function PuertoLibreDeleteExpediente({
  vehiculoId,
  codigo,
  variant = "section",
}: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePuertoLibreVehiculoAction({ vehiculoId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/puerto-libre");
      router.refresh();
    });
  }

  if (variant === "icon") {
    return (
      <div className="relative shrink-0">
        {!confirming ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirming(true);
            }}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-950/40 hover:text-red-300"
            aria-label={`Eliminar expediente ${codigo}`}
            title="Eliminar expediente"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          <div
            className="flex items-center gap-1"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              disabled={pending}
              onClick={handleDelete}
              className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sí"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="rounded-lg px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              No
            </button>
          </div>
        )}
        {error ? (
          <p className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-red-900/50 bg-red-950 px-2 py-1.5 text-[10px] leading-snug text-red-200 shadow-lg">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-red-900/40 bg-red-950/20 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-red-200">Eliminar expediente</h2>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
            Esta acción no se puede deshacer. Se borrará{" "}
            <span className="font-mono text-zinc-300">{codigo}</span>, sus documentos
            asociados y el sticker NFC si existe.
          </p>

          {error ? (
            <p className="mt-3 rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-950/70"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar expediente
            </button>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Sí, eliminar {codigo}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
