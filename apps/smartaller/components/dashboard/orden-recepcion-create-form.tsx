"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { createOrdenRecepcionAction } from "@/app/actions/ordenes-recepcion";
import { OrdenRecepcionForm } from "@/components/dashboard/orden-recepcion-form";
import type { OrdenRecepcionFormValue } from "@/lib/schemas/orden-recepcion";
import type { FichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";

type Props = {
  vehiculoId: string;
  placa: string;
  odometroInicial: number | null;
  odometroLabel: string;
  fichaVehiculo: FichaVehiculoInspeccion;
  recienRegistrado?: boolean;
  desdeTelegram?: boolean;
};

export function OrdenRecepcionCreateForm({
  vehiculoId,
  placa,
  odometroInicial,
  odometroLabel,
  fichaVehiculo,
  recienRegistrado,
  desdeTelegram,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [orden, setOrden] = useState<OrdenRecepcionFormValue>({
    checklist: [],
    estadoVisual: { fotos: [] },
    kilometraje: odometroInicial,
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createOrdenRecepcionAction({
        vehiculoId,
        ...orden,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/dashboard/vehiculos/${vehiculoId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
      {desdeTelegram && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          Placa <span className="font-mono font-semibold">{placa}</span> identificada por Telegram.
          Completa la planilla de inspección de ingreso.
        </div>
      )}

      {recienRegistrado && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Vehículo <span className="font-mono font-semibold">{placa}</span> registrado. Ahora
          completa la inspección de ingreso.
        </div>
      )}

      <OrdenRecepcionForm
        value={orden}
        onChange={setOrden}
        odometroLabel={odometroLabel}
        fichaVehiculo={fichaVehiculo}
      />

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/vehiculos/${vehiculoId}`)}
          className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500"
        >
          Omitir por ahora
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="h-4 w-4" />
          )}
          Guardar inspección
        </button>
      </div>
    </form>
  );
}
