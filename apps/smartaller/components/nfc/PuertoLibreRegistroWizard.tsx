"use client";

import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";

type Props = {
  tallerNombre: string;
};

/** Alta directa de Planilla Puerto Libre (fase 1). */
export function PuertoLibreRegistroWizard({ tallerNombre }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Nuevo expediente</p>
          <p className="mt-0.5 text-sm text-zinc-400">{tallerNombre}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
        <PlanillaAltaPuertoLibre />
      </div>
    </div>
  );
}
