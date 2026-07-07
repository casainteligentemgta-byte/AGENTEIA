"use client";

import { useState, useTransition } from "react";
import { Loader2, Package } from "lucide-react";
import { createRepuestoAction } from "@/app/actions/repuestos";

export function RepuestoCatalogForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createRepuestoAction({
        nombre: String(form.get("nombre") ?? ""),
        sku: String(form.get("sku") ?? ""),
        unidad: String(form.get("unidad") ?? ""),
        precioVenta: String(form.get("precioVenta") ?? "0"),
        stockActual: String(form.get("stockActual") ?? "0"),
        stockMinimo: String(form.get("stockMinimo") ?? "0"),
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setMessage("Repuesto agregado al catálogo");
      e.currentTarget.reset();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-zinc-100">Nuevo repuesto</h2>
          <p className="text-sm text-zinc-500">Catálogo e inventario del taller</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nombre" className="mb-1 block text-sm text-zinc-400">
            Nombre *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            placeholder="Pastillas de freno delanteras"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="sku" className="mb-1 block text-sm text-zinc-400">
            SKU / referencia
          </label>
          <input
            id="sku"
            name="sku"
            placeholder="PF-2041"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="unidad" className="mb-1 block text-sm text-zinc-400">
            Unidad
          </label>
          <input
            id="unidad"
            name="unidad"
            defaultValue="und"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="precioVenta" className="mb-1 block text-sm text-zinc-400">
            Precio venta (COP)
          </label>
          <input
            id="precioVenta"
            name="precioVenta"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="stockActual" className="mb-1 block text-sm text-zinc-400">
            Stock actual
          </label>
          <input
            id="stockActual"
            name="stockActual"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="stockMinimo" className="mb-1 block text-sm text-zinc-400">
            Stock mínimo
          </label>
          <input
            id="stockMinimo"
            name="stockMinimo"
            type="number"
            min="0"
            step="1"
            defaultValue="0"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Guardar repuesto
      </button>
    </form>
  );
}
