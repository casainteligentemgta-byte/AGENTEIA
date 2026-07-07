"use client";

import { useState, useTransition } from "react";
import { Loader2, Wrench } from "lucide-react";
import { createMantenimientoB2C } from "@/app/actions/mantenimientos";

type MantenimientoB2cFormProps = {
  vehiculoId: string;
  unidadOdometro: "km" | "horas";
};

export function MantenimientoB2cForm({ vehiculoId, unidadOdometro }: MantenimientoB2cFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    formData.set("vehiculoId", vehiculoId);

    startTransition(async () => {
      const result = await createMantenimientoB2C(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      e.currentTarget.reset();
    });
  }

  const odometroLabel = unidadOdometro === "horas" ? "Horómetro (h)" : "Kilometraje";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-zinc-900">Registrar mantenimiento</h2>
          <p className="text-sm text-zinc-500">Anota servicios que hagas por tu cuenta</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="descripcion" className="mb-1.5 block text-sm font-medium text-zinc-600">
            Descripción del servicio
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            required
            rows={2}
            placeholder="Ej. Cambio de aceite, revisión de frenos…"
            className="app-input min-h-[72px] resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="odometro" className="mb-1.5 block text-sm font-medium text-zinc-600">
              {odometroLabel}
            </label>
            <input
              id="odometro"
              name="odometro"
              type="number"
              min="0"
              placeholder={unidadOdometro === "horas" ? "1250" : "45320"}
              className="app-input"
            />
          </div>
          <div>
            <label htmlFor="costo" className="mb-1.5 block text-sm font-medium text-zinc-600">
              Costo (opcional)
            </label>
            <input
              id="costo"
              name="costo"
              type="number"
              min="0"
              step="0.01"
              placeholder="85000"
              className="app-input"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
            Mantenimiento registrado.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar
        </button>
      </form>
    </section>
  );
}
