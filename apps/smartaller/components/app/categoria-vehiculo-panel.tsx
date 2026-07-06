"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { actualizarCategoriaVehiculoPorVehiculo } from "@/app/actions/mantenimientos";
import type { CategoriaVehiculoId, EstadoCategoriaValue } from "@/lib/schemas/categoria-vehiculo";
import type { CategoriaSaludResumen } from "@/lib/vehicles/vehicle-health";
import { cn } from "@/lib/utils";

const ESTADOS: { value: EstadoCategoriaValue; label: string }[] = [
  { value: "bien", label: "Bien" },
  { value: "atencion", label: "Atención" },
  { value: "critico", label: "Crítico" },
];

type CategoriaVehiculoPanelProps = {
  vehiculoId: string;
  categorias: CategoriaSaludResumen[];
};

function CategoriaForm({
  vehiculoId,
  categoria,
}: {
  vehiculoId: string;
  categoria: CategoriaSaludResumen;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [estado, setEstado] = useState<EstadoCategoriaValue>(categoria.estado ?? "bien");
  const [fecha, setFecha] = useState(categoria.fechaRevision?.slice(0, 10) ?? "");
  const [notas, setNotas] = useState(categoria.notas ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await actualizarCategoriaVehiculoPorVehiculo(vehiculoId, categoria.id, {
        estado,
        fecha_revision: fecha.trim() ? fecha : null,
        notas: notas.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-100 px-4 py-3">
      <p className="text-sm font-semibold text-zinc-800">{categoria.label}</p>

      <div className="grid grid-cols-3 gap-2">
        {ESTADOS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setEstado(opt.value)}
            className={cn(
              "rounded-xl border py-2 text-xs font-semibold transition",
              estado === opt.value
                ? opt.value === "bien"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : opt.value === "atencion"
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-red-300 bg-red-50 text-red-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-500"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">
          Fecha de revisión
        </label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="app-input py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Notas</label>
        <input
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Opcional"
          className="app-input py-2"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Estado actualizado.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Guardar {categoria.label.toLowerCase()}
      </button>
    </form>
  );
}

export function CategoriaVehiculoPanel({ vehiculoId, categorias }: CategoriaVehiculoPanelProps) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section className="app-card-white overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Actualizar estado por categoría</h2>
          <p className="text-xs text-zinc-500">Registra batería, neumáticos, aceite o revisión</p>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 text-zinc-400 transition", abierto && "rotate-180")}
        />
      </button>

      {abierto && (
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {categorias.map((cat) => (
            <CategoriaForm key={cat.id} vehiculoId={vehiculoId} categoria={cat} />
          ))}
        </div>
      )}
    </section>
  );
}
