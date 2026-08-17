"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  name?: string;
  className?: string;
};

/**
 * Fecha con input nativo (abre el picker en iOS/Android/desktop).
 * Icono decorativo a la izquierda; showPicker() cuando el navegador lo permite.
 */
export function PlanillaFechaField({
  label = "Fecha *",
  value,
  onChange,
  required,
  name = "fecha",
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleActivate() {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      }
    } catch {
      // Sin gesto válido o sin soporte: el tap del input nativo abre el picker.
    }
  }

  return (
    <div className={`min-w-0 ${label ? "space-y-2.5" : ""} ${className}`}>
      {label ? (
        <label htmlFor={name} className="block text-sm text-slate-400">
          {label}
        </label>
      ) : null}
      <div className="relative min-w-0 w-full">
        <CalendarDays
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-cyan-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          id={name}
          type="date"
          name={name}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleActivate}
          aria-label={label || "Seleccionar fecha"}
          className="pl-date-native box-border h-12 w-full max-w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none [color-scheme:dark] focus:border-cyan-500/60 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
        />
      </div>
    </div>
  );
}
