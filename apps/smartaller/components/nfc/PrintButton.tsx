"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:border-cyan-500/40 print:hidden"
    >
      <Printer className="h-4 w-4 text-cyan-400" />
      Imprimir
    </button>
  );
}
