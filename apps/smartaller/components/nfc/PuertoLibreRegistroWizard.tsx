"use client";

import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";

/** Alta directa de Planilla Puerto Libre (fase 1). */
export function PuertoLibreRegistroWizard() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
      <PlanillaAltaPuertoLibre />
    </div>
  );
}
