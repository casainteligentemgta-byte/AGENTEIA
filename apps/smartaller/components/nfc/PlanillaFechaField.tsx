"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";

function formatFechaEs(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "Elegir fecha";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  name?: string;
  className?: string;
};

/**
 * Campo de fecha con botón centrado (evita el desalineado de input[type=date] en iOS Safari).
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

  function openPicker() {
    const el = inputRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
        return;
      }
    } catch {
      // Algunos navegadores bloquean showPicker sin gesto directo; caemos a click.
    }
    el.click();
  }

  return (
    <div className={`min-w-0 ${label ? "space-y-2.5" : ""} ${className}`}>
      {label ? <span className="block text-sm text-slate-400">{label}</span> : null}
      <div className="relative min-w-0 w-full">
        <button
          type="button"
          onClick={openPicker}
          className="box-border flex h-12 w-full max-w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 text-left text-sm text-slate-100 outline-none transition hover:border-slate-500 focus-visible:border-cyan-500/60 focus-visible:ring-2 focus-visible:ring-cyan-500/30"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
          <span className="leading-none">{formatFechaEs(value)}</span>
        </button>
        <input
          ref={inputRef}
          type="date"
          name={name}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </div>
    </div>
  );
}
