"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { createOrdenRecepcionAction } from "@/app/actions/ordenes-recepcion";
import { OrdenRecepcionForm } from "@/components/dashboard/orden-recepcion-form";
import { InspeccionWizardFotos } from "@/components/dashboard/inspeccion-wizard-fotos";
import { INSPECCION_FOTO_PASOS, PASO_PROTOCOLO } from "@/lib/inspeccion/pasos";
import type { OrdenRecepcionFormValue } from "@/lib/schemas/orden-recepcion";
import type { FichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";

type Props = {
  vehiculoId?: string;
  placa?: string;
  odometroInicial?: number | null;
  odometroLabel?: string;
  fichaVehiculo?: FichaVehiculoInspeccion;
  recienRegistrado?: boolean;
  desdeTelegram?: boolean;
};

export function OrdenRecepcionCreateForm({
  vehiculoId: vehiculoIdInicial,
  placa: placaInicial,
  odometroInicial,
  odometroLabel: odometroLabelInicial = "Kilometraje",
  fichaVehiculo: fichaInicial,
  recienRegistrado,
  desdeTelegram,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pasoIndex, setPasoIndex] = useState(0);

  const [vehiculoId, setVehiculoId] = useState(vehiculoIdInicial);
  const [placa, setPlaca] = useState(placaInicial ?? "");
  const [fichaVehiculo, setFichaVehiculo] = useState(fichaInicial);
  const [odometroLabel, setOdometroLabel] = useState(odometroLabelInicial);

  const [orden, setOrden] = useState<OrdenRecepcionFormValue>({
    checklist: [],
    estadoVisual: { fotos: [] },
    kilometraje: odometroInicial ?? null,
  });

  const enProtocolo = pasoIndex >= INSPECCION_FOTO_PASOS.length;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vehiculoId) {
      setError("Primero completa la foto frontal para identificar el vehículo.");
      return;
    }
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
      {desdeTelegram && !enProtocolo && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          Toma la <strong>foto frontal</strong> con la cámara de la app. La placa se leerá
          automáticamente para confirmar el vehículo.
        </div>
      )}

      {recienRegistrado && placa && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Vehículo <span className="font-mono font-semibold">{placa}</span> registrado.
        </div>
      )}

      {!enProtocolo ? (
        <InspeccionWizardFotos
          estadoVisual={orden.estadoVisual ?? { fotos: [] }}
          onEstadoVisualChange={(estadoVisual) => setOrden((o) => ({ ...o, estadoVisual }))}
          vehiculoId={vehiculoId}
          placaEsperada={placa || undefined}
          pasoIndex={pasoIndex}
          onPasoIndexChange={setPasoIndex}
          fichaVehiculo={fichaVehiculo}
          onVehiculoResuelto={({ vehiculoId: id, placa: p, ficha, odometroLabel: label }) => {
            setVehiculoId(id);
            setPlaca(p);
            setFichaVehiculo(ficha);
            setOdometroLabel(label);
          }}
          onKilometrajeDetectado={(km) =>
            setOrden((o) => ({ ...o, kilometraje: km }))
          }
        />
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <p className="text-sm font-medium text-zinc-200">{PASO_PROTOCOLO.titulo}</p>
            <p className="mt-1 text-xs text-zinc-500">{PASO_PROTOCOLO.instruccion}</p>
          </div>

          <OrdenRecepcionForm
            value={orden}
            onChange={setOrden}
            odometroLabel={odometroLabel}
            fichaVehiculo={fichaVehiculo}
            soloProtocolo
          />

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPasoIndex(INSPECCION_FOTO_PASOS.length - 1)}
              className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500"
            >
              Volver a fotos
            </button>
            {vehiculoId && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/vehiculos/${vehiculoId}`)}
                className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500"
              >
                Omitir por ahora
              </button>
            )}
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
        </>
      )}
    </form>
  );
}
