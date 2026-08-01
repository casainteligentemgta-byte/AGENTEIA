"use client";

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
 * Campo de fecha con UI custom y input nativo encima (tap abre el picker en iOS/Android).
 */
export function PlanillaFechaField({
  label = "Fecha *",
  value,
  onChange,
  required,
  name = "fecha",
  className = "",
}: Props) {
  return (
    <div className={`min-w-0 ${label ? "space-y-2.5" : ""} ${className}`}>
      {label ? (
        <label htmlFor={name} className="block text-sm text-slate-400">
          {label}
        </label>
      ) : null}
      <div className="relative min-w-0 w-full">
        <div
          aria-hidden
          className="box-border flex h-12 w-full max-w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 text-left text-sm text-slate-100"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-400" />
          <span className="leading-none">{formatFechaEs(value)}</span>
        </div>
        <input
          id={name}
          type="date"
          name={name}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="planilla-fecha-input absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label || "Seleccionar fecha"}
        />
      </div>
    </div>
  );
}
