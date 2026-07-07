"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import {
  deactivateRepuestoAction,
  updateRepuestoAction,
} from "@/app/actions/repuestos";
import { formatCurrency } from "@/lib/format";
import type { Repuesto } from "@/lib/repuestos/types";

type RepuestoCatalogTableProps = {
  repuestos: Repuesto[];
};

export function RepuestoCatalogTable({ repuestos }: RepuestoCatalogTableProps) {
  if (repuestos.length === 0) {
    return (
      <div className="px-5 py-16 text-center text-sm text-zinc-500">
        Sin repuestos en catálogo. Agrega el primero arriba.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50 text-left text-zinc-500">
            <th className="px-5 py-3 font-medium">Nombre</th>
            <th className="px-5 py-3 font-medium">SKU</th>
            <th className="px-5 py-3 font-medium">Stock</th>
            <th className="px-5 py-3 font-medium">Mín.</th>
            <th className="px-5 py-3 font-medium">Precio</th>
            <th className="px-5 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {repuestos.map((repuesto) => (
            <RepuestoRow key={repuesto.id} repuesto={repuesto} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepuestoRow({ repuesto }: { repuesto: Repuesto }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const bajo =
    repuesto.stock_actual <= repuesto.stock_minimo && repuesto.stock_minimo > 0;

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateRepuestoAction({
        id: repuesto.id,
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

      setEditing(false);
    });
  }

  function handleDeactivate() {
    if (!confirm(`¿Desactivar "${repuesto.nombre}" del catálogo?`)) return;

    setError(null);
    startTransition(async () => {
      const result = await deactivateRepuestoAction(repuesto.id);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  if (editing) {
    return (
      <tr className="border-b border-zinc-800/50 bg-zinc-900/40">
        <td colSpan={6} className="px-5 py-4">
          <form onSubmit={handleUpdate} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <input
                name="nombre"
                defaultValue={repuesto.nombre}
                required
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:col-span-2"
              />
              <input
                name="sku"
                defaultValue={repuesto.sku ?? ""}
                placeholder="SKU"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                name="unidad"
                defaultValue={repuesto.unidad}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                name="stockActual"
                type="number"
                min="0"
                step="1"
                defaultValue={repuesto.stock_actual}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                name="stockMinimo"
                type="number"
                min="0"
                step="1"
                defaultValue={repuesto.stock_minimo}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                name="precioVenta"
                type="number"
                min="0"
                step="1"
                defaultValue={repuesto.precio_venta}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
      <td className="px-5 py-4 font-medium text-zinc-200">{repuesto.nombre}</td>
      <td className="px-5 py-4 text-zinc-500">{repuesto.sku ?? "—"}</td>
      <td
        className={
          bajo ? "px-5 py-4 font-semibold text-amber-400" : "px-5 py-4 text-zinc-300"
        }
      >
        {Number(repuesto.stock_actual).toLocaleString("es-CO")} {repuesto.unidad}
      </td>
      <td className="px-5 py-4 text-zinc-500">
        {Number(repuesto.stock_minimo).toLocaleString("es-CO")}
      </td>
      <td className="px-5 py-4 text-zinc-200">
        {formatCurrency(Number(repuesto.precio_venta))}
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
            aria-label={`Editar ${repuesto.nombre}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={pending}
            className="rounded-lg p-2 text-zinc-400 hover:bg-red-950/50 hover:text-red-400 disabled:opacity-50"
            aria-label={`Desactivar ${repuesto.nombre}`}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
        {error && <p className="mt-1 text-right text-xs text-red-400">{error}</p>}
      </td>
    </tr>
  );
}
