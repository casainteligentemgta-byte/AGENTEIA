"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { addRepuestosFromFormData } from "@/app/actions/repuestos";
import { RepuestosLineasInput } from "@/components/dashboard/repuestos-lineas-input";
import type { Repuesto } from "@/lib/repuestos/types";

type MantenimientoRepuestosEditorProps = {
  mantenimientoId: string;
  catalogo: Repuesto[];
};

export function MantenimientoRepuestosEditor({
  mantenimientoId,
  catalogo,
}: MantenimientoRepuestosEditorProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addRepuestosFromFormData(mantenimientoId, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Repuestos registrados en la orden");
      setFormKey((k) => k + 1);
    });
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="mt-3 border-t border-zinc-800 pt-3">
      <RepuestosLineasInput catalogo={catalogo} disabled={pending} />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {message && <p className="mt-2 text-xs text-emerald-400">{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Agregar repuestos a esta OS
      </button>
    </form>
  );
}
