"use client";

import { useState, useTransition } from "react";
import { Loader2, Wrench } from "lucide-react";
import { createRevisionMantenimiento } from "@/app/actions/mantenimientos";
import { DiagnosticoMediaInput } from "@/components/dashboard/diagnostico-media-input";
import {
  DESGASTE_CADENA_OPCIONES,
  ESTADO_MANGUERAS_OPCIONES,
  INDUSTRIA_LABELS,
  type TipoIndustria,
} from "@/lib/platform/types";

type VehiculoOption = {
  id: string;
  placa: string;
  nombre_cliente: string | null;
};

type RevisionFormProps = {
  tipoIndustria: TipoIndustria;
  vehiculos: VehiculoOption[];
};

export function RevisionForm({ tipoIndustria, vehiculos }: RevisionFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createRevisionMantenimiento(tipoIndustria, formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setFormKey((k) => k + 1);
    });
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-zinc-100">Nueva revisión</h2>
          <p className="text-sm text-zinc-500">
            Protocolo {INDUSTRIA_LABELS[tipoIndustria]}
          </p>
        </div>
      </div>

      {vehiculos.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Registra un vehículo (Telegram o manualmente) antes de cargar revisiones.
        </p>
      ) : (
        <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vehiculoId" className="mb-1.5 block text-sm text-zinc-400">
              Vehículo / activo
            </label>
            <select
              id="vehiculoId"
              name="vehiculoId"
              required
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Seleccionar…</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa}
                  {v.nombre_cliente ? ` — ${v.nombre_cliente}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="descripcion" className="mb-1.5 block text-sm text-zinc-400">
              Descripción del servicio
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              required
              rows={2}
              placeholder="Ej. Revisión periódica, cambio de aceite…"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
            />
          </div>

          {tipoIndustria === "concesionario" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="voltajeBateria" className="mb-1.5 block text-sm text-zinc-400">
                  Voltaje batería (V)
                </label>
                <input
                  id="voltajeBateria"
                  name="voltajeBateria"
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  required
                  placeholder="12.6"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="kilometraje" className="mb-1.5 block text-sm text-zinc-400">
                  Kilometraje
                </label>
                <input
                  id="kilometraje"
                  name="kilometraje"
                  type="number"
                  min="0"
                  required
                  placeholder="45320"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {tipoIndustria === "bicicletas" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="desgasteCadena" className="mb-1.5 block text-sm text-zinc-400">
                  Desgaste de cadena
                </label>
                <select
                  id="desgasteCadena"
                  name="desgasteCadena"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  {DESGASTE_CADENA_OPCIONES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="presionSuspensionPsi" className="mb-1.5 block text-sm text-zinc-400">
                  Presión suspensión (PSI)
                </label>
                <input
                  id="presionSuspensionPsi"
                  name="presionSuspensionPsi"
                  type="number"
                  min="0"
                  max="400"
                  required
                  placeholder="120"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {tipoIndustria === "constructora" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="horometroActual" className="mb-1.5 block text-sm text-zinc-400">
                  Horómetro actual (h)
                </label>
                <input
                  id="horometroActual"
                  name="horometroActual"
                  type="number"
                  min="0"
                  required
                  placeholder="1250"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="estadoManguerasHidraulicas" className="mb-1.5 block text-sm text-zinc-400">
                  Mangueras hidráulicas
                </label>
                <select
                  id="estadoManguerasHidraulicas"
                  name="estadoManguerasHidraulicas"
                  required
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
                >
                  {ESTADO_MANGUERAS_OPCIONES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <DiagnosticoMediaInput disabled={pending} />

          {error && (
            <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-300">
              Revisión registrada correctamente.
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar revisión
          </button>
        </form>
      )}
    </section>
  );
}
