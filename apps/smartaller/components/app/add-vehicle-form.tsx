"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createVehicle } from "@/app/actions/vehicles";
import type { TipoVehiculo } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { VehicleTypePicker } from "@/components/app/vehicle-type-picker";

export function AddVehicleForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoVehiculo>("auto");
  const [error, setError] = useState<string | null>(null);

  const config = getConfigTipoVehiculo(tipo);
  const odometroLabel = config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createVehicle({
        tipo_vehiculo: tipo,
        nick: String(form.get("nick") ?? ""),
        marca: String(form.get("marca") ?? ""),
        modelo: String(form.get("modelo") ?? ""),
        color: String(form.get("color") ?? ""),
        placa: String(form.get("placa") ?? ""),
        odometro: String(form.get("odometro") ?? ""),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/app/vehiculos/${result.data!.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-300">Tipo de vehículo</p>
        <VehicleTypePicker value={tipo} onChange={setTipo} />
      </div>

      <div className="rounded-2xl bg-white p-5 text-zinc-900 shadow-xl">
        <p className="mb-4 text-lg font-bold">Nuevo vehículo</p>

        <div className="space-y-4">
          <div>
            <label htmlFor="nick" className="mb-1.5 block text-sm text-zinc-500">
              Nick del vehículo
            </label>
            <input
              id="nick"
              name="nick"
              placeholder={`Ej. Mi ${config.labelCorto}`}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {(["marca", "modelo", "color", "placa"] as const).map((field) => (
            <div key={field}>
              <label htmlFor={field} className="mb-1.5 block text-sm capitalize text-zinc-500">
                {field === "placa" ? "Placa / identificador" : field}
              </label>
              <input
                id={field}
                name={field}
                required={field === "placa"}
                className="w-full border-b border-zinc-200 bg-transparent py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          ))}

          <div>
            <label htmlFor="odometro" className="mb-1.5 block text-sm text-zinc-500">
              {odometroLabel} (opcional)
            </label>
            <input
              id="odometro"
              name="odometro"
              inputMode="numeric"
              placeholder={config.unidadOdometro === "horas" ? "Ej. 1250" : "Ej. 10694"}
              className="w-full border-b border-zinc-200 bg-transparent py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-2xl bg-zinc-700 py-3.5 text-sm font-medium text-white transition hover:bg-zinc-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Confirmar
        </button>
      </div>
    </form>
  );
}
