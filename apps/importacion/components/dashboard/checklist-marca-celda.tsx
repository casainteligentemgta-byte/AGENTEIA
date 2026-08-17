"use client";

import type { ChecklistMarca } from "@/lib/schemas/orden-recepcion";

type Props = {
  marca: ChecklistMarca | undefined;
  onChange: (marca: ChecklistMarca | undefined) => void;
};

export function ChecklistMarcaCelda({ marca, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        title="Correcto / presente"
        onClick={() => onChange(marca === "check" ? undefined : "check")}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
          marca === "check"
            ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
            : "border-zinc-700 text-zinc-500 hover:border-emerald-600"
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        title="Falla / ausente"
        onClick={() => onChange(marca === "x" ? undefined : "x")}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
          marca === "x"
            ? "border-red-500 bg-red-500/20 text-red-400"
            : "border-zinc-700 text-zinc-500 hover:border-red-600"
        }`}
      >
        X
      </button>
    </div>
  );
}
