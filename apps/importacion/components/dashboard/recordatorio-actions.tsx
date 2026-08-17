"use client";

import { useTransition } from "react";
import { Check, Loader2, RotateCcw, X } from "lucide-react";
import { updateRecordatorioEstadoAction } from "@/app/actions/recordatorios";

type RecordatorioActionsProps = {
  recordatorioId: string;
  estado: string;
};

export function RecordatorioActions({ recordatorioId, estado }: RecordatorioActionsProps) {
  const [pending, startTransition] = useTransition();

  function setEstado(nuevoEstado: "completado" | "cancelado" | "pendiente") {
    startTransition(async () => {
      await updateRecordatorioEstadoAction({ recordatorioId, estado: nuevoEstado });
    });
  }

  if (estado === "completado") {
    return <span className="text-xs text-zinc-500">Completado</span>;
  }

  if (estado === "cancelado") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setEstado("pendiente")}
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
        Reactivar
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setEstado("completado")}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Completado
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setEstado("cancelado")}
        className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-1 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Cancelar
      </button>
    </div>
  );
}
