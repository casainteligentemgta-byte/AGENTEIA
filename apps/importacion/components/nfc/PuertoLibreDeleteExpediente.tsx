"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deletePuertoLibreVehiculoAction } from "@/app/actions/nfc/importacion-vehiculo";

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
      router.push("/importacion");
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
            aria-label={`Eliminar ${codigo}`}
            title="Eliminar"
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
    <div className="space-y-2">
      {error ? (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-950/70 sm:w-auto"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
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
            Sí, eliminar
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
  );
}
