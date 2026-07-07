"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Repuesto } from "@/lib/repuestos/types";

export type RepuestoLineaDraft = {
  key: string;
  repuestoId: string;
  nombre: string;
  cantidad: string;
  precioUnitario: string;
};

type RepuestosLineasInputProps = {
  catalogo: Repuesto[];
  disabled?: boolean;
};

function emptyLinea(): RepuestoLineaDraft {
  return {
    key: crypto.randomUUID(),
    repuestoId: "",
    nombre: "",
    cantidad: "1",
    precioUnitario: "",
  };
}

export function RepuestosLineasInput({ catalogo, disabled }: RepuestosLineasInputProps) {
  const [lineas, setLineas] = useState<RepuestoLineaDraft[]>([]);

  const jsonValue = useMemo(() => {
    const payload = lineas
      .filter((l) => l.nombre.trim())
      .map((l) => ({
        repuestoId: l.repuestoId || undefined,
        nombre: l.nombre.trim(),
        cantidad: Number(l.cantidad.replace(",", ".")) || 1,
        precioUnitario: Number(l.precioUnitario.replace(",", ".")) || 0,
      }));
    return JSON.stringify(payload);
  }, [lineas]);

  function addLinea() {
    setLineas((prev) => [...prev, emptyLinea()]);
  }

  function removeLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLinea(key: string, patch: Partial<RepuestoLineaDraft>) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectCatalogo(key: string, repuestoId: string) {
    const item = catalogo.find((r) => r.id === repuestoId);
    if (!item) {
      updateLinea(key, { repuestoId: "", nombre: "" });
      return;
    }
    updateLinea(key, {
      repuestoId: item.id,
      nombre: item.nombre,
      precioUnitario: String(item.precio_venta),
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-700/80 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-200">Repuestos utilizados</p>
          <p className="text-xs text-zinc-500">Opcional · el cliente los verá en su historial</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={addLinea}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-blue-500 hover:text-blue-300 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Línea
        </button>
      </div>

      <input type="hidden" name="repuestosLineas" value={jsonValue} readOnly />

      {lineas.length === 0 ? (
        <p className="text-xs text-zinc-500">Sin repuestos agregados.</p>
      ) : (
        <ul className="space-y-3">
          {lineas.map((linea) => (
            <li
              key={linea.key}
              className="grid gap-2 rounded-lg border border-zinc-800 p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-4">
                <label className="mb-1 block text-[11px] text-zinc-500">Del catálogo</label>
                <select
                  value={linea.repuestoId}
                  disabled={disabled}
                  onChange={(e) => selectCatalogo(linea.key, e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-blue-500"
                >
                  <option value="">Manual / otro</option>
                  {catalogo.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                      {r.sku ? ` (${r.sku})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="mb-1 block text-[11px] text-zinc-500">Nombre *</label>
                <input
                  value={linea.nombre}
                  disabled={disabled}
                  onChange={(e) => updateLinea(linea.key, { nombre: e.target.value })}
                  required={lineas.length > 0}
                  placeholder="Filtro de aceite"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-500">Cant.</label>
                <input
                  value={linea.cantidad}
                  disabled={disabled}
                  onChange={(e) => updateLinea(linea.key, { cantidad: e.target.value })}
                  inputMode="decimal"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-zinc-500">Precio unit.</label>
                <input
                  value={linea.precioUnitario}
                  disabled={disabled}
                  onChange={(e) => updateLinea(linea.key, { precioUnitario: e.target.value })}
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex items-end justify-end sm:col-span-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeLinea(linea.key)}
                  className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                  aria-label="Quitar línea"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
