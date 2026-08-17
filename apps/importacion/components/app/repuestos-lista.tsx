import type { MantenimientoRepuestoLinea } from "@/lib/repuestos/types";
import { formatCurrency } from "@/lib/format";
import { Package } from "lucide-react";

type RepuestosListaProps = {
  lineas: MantenimientoRepuestoLinea[];
  className?: string;
  variant?: "light" | "dark";
};

export function RepuestosLista({ lineas, className, variant = "light" }: RepuestosListaProps) {
  if (lineas.length === 0) return null;

  const total = lineas.reduce((sum, l) => sum + Number(l.subtotal), 0);
  const isDark = variant === "dark";

  return (
    <div className={className}>
      <p
        className={
          isDark
            ? "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
            : "mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
        }
      >
        <Package className="h-3.5 w-3.5" />
        Repuestos utilizados
      </p>
      <ul
        className={
          isDark
            ? "space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
            : "space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3"
        }
      >
        {lineas.map((linea) => (
          <li
            key={linea.id}
            className={
              isDark
                ? "flex items-start justify-between gap-3 text-sm text-zinc-300"
                : "flex items-start justify-between gap-3 text-sm text-zinc-700"
            }
          >
            <div className="min-w-0">
              <p className={isDark ? "font-medium text-zinc-100" : "font-medium text-zinc-800"}>
                {linea.nombre}
              </p>
              <p className="text-xs text-zinc-500">
                {Number(linea.cantidad).toLocaleString("es-CO")} ×{" "}
                {formatCurrency(Number(linea.precio_unitario))}
              </p>
            </div>
            <p className={isDark ? "shrink-0 font-semibold text-zinc-100" : "shrink-0 font-semibold text-zinc-800"}>
              {formatCurrency(Number(linea.subtotal))}
            </p>
          </li>
        ))}
        <li
          className={
            isDark
              ? "flex justify-between border-t border-zinc-800 pt-2 text-sm font-semibold text-zinc-100"
              : "flex justify-between border-t border-zinc-200 pt-2 text-sm font-semibold text-zinc-800"
          }
        >
          <span>Subtotal repuestos</span>
          <span>{formatCurrency(total)}</span>
        </li>
      </ul>
    </div>
  );
}
