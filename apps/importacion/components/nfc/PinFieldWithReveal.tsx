"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  name?: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  /** Clases del label (zinc vs slate según la pantalla). */
  labelClassName?: string;
  inputClassName?: string;
};

/**
 * Campo PIN numérico con botón ojo para mostrar/ocultar el valor.
 */
export function PinFieldWithReveal({
  name = "pin",
  label,
  required,
  placeholder = "4–8 dígitos",
  defaultValue,
  className = "",
  labelClassName = "text-xs text-zinc-500",
  inputClassName = "border-zinc-700 bg-zinc-900 text-zinc-100 focus:border-cyan-500/60",
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={`block min-w-0 flex-1 space-y-1.5 ${className}`}>
      <span className={labelClassName}>{label}</span>
      <div className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={8}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          autoComplete="new-password"
          className={`w-full rounded-xl border py-2.5 pl-3 pr-11 text-sm outline-none ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 transition hover:text-zinc-200"
          aria-label={visible ? "Ocultar PIN" : "Mostrar PIN"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
