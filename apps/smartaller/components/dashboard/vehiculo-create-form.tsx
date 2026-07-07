"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createVehiculoTallerAction } from "@/app/actions/vehiculos";
import type { TipoVehiculo } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import { VehicleTypePicker, VehicleTypeIcon } from "@/components/app/vehicle-type-picker";

export function VehiculoCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<TipoVehiculo>("auto");
  const [error, setError] = useState<string | null>(null);

  const config = getConfigTipoVehiculo(tipo);
  const odometroLabel =
    config.unidadOdometro === "horas" ? "Horas de motor al entrega" : "Kilometraje al entrega";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createVehiculoTallerAction({
        tipo_vehiculo: tipo,
        placa: String(form.get("placa") ?? ""),
        marca: String(form.get("marca") ?? ""),
        modelo: String(form.get("modelo") ?? ""),
        color: String(form.get("color") ?? ""),
        nombreCliente: String(form.get("nombreCliente") ?? ""),
        telefonoCliente: String(form.get("telefonoCliente") ?? ""),
        odometro: String(form.get("odometro") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/dashboard/vehiculos/${result.vehiculoId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-zinc-400">Tipo de vehículo</p>
        <VehicleTypePicker value={tipo} onChange={setTipo} />
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
            <VehicleTypeIcon tipo={tipo} className="h-7 w-7 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Datos del vehículo</h2>
            <p className="text-sm text-zinc-500">Registro de venta o entrega al cliente</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="placa" className="block text-sm font-medium text-zinc-300">
              Placa / identificador *
            </label>
            <input
              id="placa"
              name="placa"
              required
              placeholder="Ej. ABC123"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm uppercase outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="marca" className="block text-sm font-medium text-zinc-300">
              Marca
            </label>
            <input
              id="marca"
              name="marca"
              placeholder="Ej. Toyota"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="modelo" className="block text-sm font-medium text-zinc-300">
              Modelo
            </label>
            <input
              id="modelo"
              name="modelo"
              placeholder="Ej. Corolla Cross"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="color" className="block text-sm font-medium text-zinc-300">
              Color
            </label>
            <input
              id="color"
              name="color"
              placeholder="Ej. Blanco perla"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="odometro" className="block text-sm font-medium text-zinc-300">
              {odometroLabel} (opcional)
            </label>
            <input
              id="odometro"
              name="odometro"
              inputMode="numeric"
              placeholder={config.unidadOdometro === "horas" ? "0" : "15"}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold text-zinc-100">Comprador</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Para recordatorios, WhatsApp y portal del cliente
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nombreCliente" className="block text-sm font-medium text-zinc-300">
              Nombre completo *
            </label>
            <input
              id="nombreCliente"
              name="nombreCliente"
              required
              placeholder="Ej. María López"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="telefonoCliente" className="block text-sm font-medium text-zinc-300">
              Teléfono (WhatsApp) *
            </label>
            <input
              id="telefonoCliente"
              name="telefonoCliente"
              required
              placeholder="3001234567"
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Registrar vehículo
        </button>
      </div>
    </form>
  );
}
