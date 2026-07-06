"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { buscarHistorialCliente } from "@/app/actions/cliente";
import type { VehiculoConHistorial } from "@/lib/types";
import { HistorialVehiculo } from "@/components/cliente/historial";

export function ClienteBuscarForm() {
  const searchParams = useSearchParams();
  const placaInicial = searchParams.get("placa") ?? "";
  const autoBuscado = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [vehiculo, setVehiculo] = useState<VehiculoConHistorial | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!placaInicial || autoBuscado.current) return;
    autoBuscado.current = true;

    const formData = new FormData();
    formData.set("placa", placaInicial);

    startTransition(async () => {
      const result = await buscarHistorialCliente(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setVehiculo(result.data);
    });
  }, [placaInicial]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setVehiculo(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await buscarHistorialCliente(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setVehiculo(result.data);
    });
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="placa" className="block text-sm font-medium text-slate-700">
              Placa del vehículo
            </label>
            <input
              id="placa"
              name="placa"
              type="text"
              defaultValue={placaInicial}
              placeholder="ABC123"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div>
            <label htmlFor="telefonoUltimos4" className="block text-sm font-medium text-slate-700">
              Últimos 4 dígitos del teléfono
            </label>
            <input
              id="telefonoUltimos4"
              name="telefonoUltimos4"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="1234"
              pattern="\d{4}"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            <p className="mt-1 text-xs text-slate-500">Opcional si la placa es única en el taller.</p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
        >
          {pending ? "Buscando…" : "Ver mi historial"}
        </button>
      </form>

      {vehiculo && <HistorialVehiculo vehiculo={vehiculo} />}
    </div>
  );
}
