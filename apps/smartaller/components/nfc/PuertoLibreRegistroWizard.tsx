"use client";

import { PlanillaAltaPuertoLibre } from "@/components/nfc/PlanillaAltaPuertoLibre";

type Props = {
  tallerNombre: string;
};

/** Alta directa de Planilla Puerto Libre (fase 1). */
export function PuertoLibreRegistroWizard({ tallerNombre }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Planilla Puerto Libre
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Completa vehículo, importación, propietario. Luego fotos y documentos.
        </p>
        <p className="mt-1 text-xs text-zinc-600">{tallerNombre}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 sm:p-6">
        <PlanillaAltaPuertoLibre />
      </div>
    </div>
  );
}
