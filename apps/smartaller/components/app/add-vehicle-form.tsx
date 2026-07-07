"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Car, Loader2 } from "lucide-react";
import { createVehicle } from "@/app/actions/vehicles";
import type { TipoVehiculo } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { VehicleTypePicker, VehicleTypeIcon } from "@/components/app/vehicle-type-picker";

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
        codigo_vinculo: String(form.get("codigo_vinculo") ?? ""),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/app/vehiculos/${result.data!.id}`);
      router.refresh();
    });
  };

  const fields = [
    { id: "nick", label: "Nick del vehículo", required: false, placeholder: `Ej. Mi ${config.labelCorto}` },
    { id: "marca", label: "Marca", required: false, placeholder: "Ej. BAIC" },
    { id: "modelo", label: "Modelo", required: false, placeholder: "Ej. BJ40" },
    { id: "color", label: "Color", required: false, placeholder: "Ej. Blanco" },
    { id: "placa", label: "Placa / identificador", required: true, placeholder: "Ej. AA90N90" },
    {
      id: "odometro",
      label: `${odometroLabel} (opcional)`,
      required: false,
      placeholder: config.unidadOdometro === "horas" ? "1250" : "10694",
      inputMode: "numeric" as const,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-3 text-center text-sm font-medium text-zinc-400">Tipo de vehículo</p>
        <VehicleTypePicker value={tipo} onChange={setTipo} />
      </div>

      <div className="app-card-white p-5 text-zinc-900">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
            <VehicleTypeIcon tipo={tipo} className="h-7 w-7 text-zinc-700" />
          </div>
          <h2 className="text-lg font-bold">Nuevo vehículo</h2>
        </div>

        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className="mb-1.5 block text-sm font-medium text-zinc-600">
                {field.label}
              </label>
              <input
                id={field.id}
                name={field.id}
                required={field.required}
                placeholder={field.placeholder}
                inputMode={field.inputMode}
                className="app-input"
              />
            </div>
          ))}
          <div>
            <label htmlFor="codigo_vinculo" className="mb-1.5 block text-sm font-medium text-zinc-600">
              Código de taller (si te lo dieron)
            </label>
            <input
              id="codigo_vinculo"
              name="codigo_vinculo"
              placeholder="Ej. ABC12345"
              className="app-input uppercase"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-zinc-400">
              Solo si tu placa ya está en un taller y quieres vincular el historial.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-2xl bg-zinc-600 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-500 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Car className="h-4 w-4" />}
          Confirmar
        </button>
      </div>
    </form>
  );
}
