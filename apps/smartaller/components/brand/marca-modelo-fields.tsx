"use client";

import { getBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

type MarcaModeloFieldsProps = {
  marca: string;
  modelo: string;
  onMarcaChange: (value: string) => void;
  onModeloChange: (value: string) => void;
  marcaId?: string;
  modeloId?: string;
  marcaPlaceholder?: string;
  modeloPlaceholder?: string;
  variant?: "light" | "dark";
  required?: boolean;
};

export function MarcaModeloFields({
  marca,
  modelo,
  onMarcaChange,
  onModeloChange,
  marcaId = "marca",
  modeloId = "modelo",
  marcaPlaceholder = "Ej. Toyota",
  modeloPlaceholder = "Ej. Corolla Cross",
  variant = "dark",
  required,
}: MarcaModeloFieldsProps) {
  const brand = getBrand();
  const catalog = brand.vehicleCatalog;
  const locked = catalog.locked && Boolean(catalog.lockedMarca);
  const modeloRequired = required ?? locked;
  const isLight = variant === "light";

  const labelClass = isLight
    ? "mb-1.5 block text-sm font-medium text-zinc-600"
    : "block text-sm font-medium text-zinc-300";
  const inputClass = isLight
    ? "app-input"
    : "mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-blue-500";

  return (
    <>
      <div>
        <label htmlFor={marcaId} className={labelClass}>
          Marca
        </label>
        {locked ? (
          <input
            id={marcaId}
            name={marcaId}
            value={catalog.lockedMarca ?? ""}
            readOnly
            className={cn(inputClass, "cursor-not-allowed opacity-90")}
            aria-readonly="true"
          />
        ) : (
          <input
            id={marcaId}
            name={marcaId}
            value={marca}
            onChange={(e) => onMarcaChange(e.target.value)}
            placeholder={marcaPlaceholder}
            className={inputClass}
          />
        )}
      </div>

      <div>
        <label htmlFor={modeloId} className={labelClass}>
          Modelo{modeloRequired ? " *" : ""}
        </label>
        {locked ? (
          <>
            <select
              id={modeloId}
              name={modeloId}
              required={modeloRequired}
              value={modelo}
              onChange={(e) => onModeloChange(e.target.value)}
              className={inputClass}
            >
              <option value="">{brand.copy.vehicleForm.modelPlaceholder}</option>
              {catalog.models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {catalog.modelsProvisional && (
              <p className={cn("mt-1 text-xs", isLight ? "text-zinc-400" : "text-zinc-500")}>
                {brand.copy.vehicleForm.modelHint}
              </p>
            )}
          </>
        ) : (
          <input
            id={modeloId}
            name={modeloId}
            value={modelo}
            onChange={(e) => onModeloChange(e.target.value)}
            placeholder={modeloPlaceholder}
            className={inputClass}
          />
        )}
      </div>
    </>
  );
}
