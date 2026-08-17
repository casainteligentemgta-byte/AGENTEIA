"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteVehiculoTallerAction } from "@/app/actions/vehiculos";

type VehiculoDeleteSectionProps = {
  vehiculoId: string;
  placa: string;
  vinculadoApp: boolean;
  mantenimientosCount: number;
  recordatoriosCount: number;
  tieneInspeccion: boolean;
};

export function VehiculoDeleteSection({
  vehiculoId,
  placa,
  vinculadoApp,
  mantenimientosCount,
  recordatoriosCount,
  tieneInspeccion,
}: VehiculoDeleteSectionProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteVehiculoTallerAction(vehiculoId);
      if (!result.ok) {
        setError(result.error ?? "No se pudo eliminar el vehículo");
        return;
      }
      router.push("/dashboard/vehiculos");
      router.refresh();
    });
  }

  return (
    <section className="glass rounded-2xl border border-red-900/40 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="flex-1">
          <h2 className="font-semibold text-red-200">Eliminar vehículo</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Esta acción no se puede deshacer. Se eliminará{" "}
            <span className="font-mono text-zinc-300">{placa}</span> de tu flota.
          </p>

          <ul className="mt-3 space-y-1 text-sm text-zinc-500">
            {tieneInspeccion && <li>· Se borrarán las inspecciones de ingreso asociadas</li>}
            {recordatoriosCount > 0 && (
              <li>
                · Se eliminarán {recordatoriosCount} recordatorio
                {recordatoriosCount === 1 ? "" : "s"}
              </li>
            )}
            {mantenimientosCount > 0 && (
              <li>
                · {mantenimientosCount} servicio{mantenimientosCount === 1 ? "" : "s"} quedará
                {mantenimientosCount === 1 ? "" : "n"} en el historial del taller sin vehículo
                vinculado
              </li>
            )}
            {vinculadoApp && (
              <li className="text-amber-400/90">
                · Este vehículo está vinculado a un usuario de la app: también desaparecerá de su
                cuenta
              </li>
            )}
          </ul>

          {error && (
            <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2.5 text-sm font-medium text-red-300 hover:bg-red-950/50"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar vehículo
            </button>
          ) : (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Sí, eliminar {placa}
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
      </div>
    </section>
  );
}
