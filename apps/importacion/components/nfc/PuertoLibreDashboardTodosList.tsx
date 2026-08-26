"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { PuertoLibreSwipeDeleteExpediente } from "@/components/nfc/PuertoLibreSwipeDeleteExpediente";
import { compareExpedientesAsc } from "@/lib/importacion/expediente";

export type DashboardTodosItem = {
  id: string;
  href: string;
  codigo: string;
  vehiculo: string;
  codigoExpediente: string | null;
  created_at: string;
};

type SortDir = "asc" | "desc";

type Props = {
  items: DashboardTodosItem[];
  emptyMessage: string;
};

export function PuertoLibreDashboardTodosList({ items, emptyMessage }: Props) {
  const [sortDir, setSortDir] = useState<SortDir | null>(null);

  const displayed = useMemo(() => {
    if (!sortDir) return items;
    const sorted = [...items].sort(compareExpedientesAsc);
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [items, sortDir]);

  function toggleSort() {
    setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <h2 className="smartimport-bucket-title uppercase tracking-wider text-zinc-400">
          Todos
        </h2>
        <span
          className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${
            items.length > 0
              ? "bg-red-950/50 text-red-300"
              : "bg-zinc-900 text-zinc-500"
          }`}
        >
          {items.length}
        </span>
      </summary>
      <div className="border-t border-zinc-800/60 px-2 pb-2 pt-1">
        {items.length === 0 ? (
          <p className="px-1 py-3 text-center text-sm text-zinc-500">
            {emptyMessage}
          </p>
        ) : (
          <>
            <div
              role="button"
              tabIndex={0}
              onDoubleClick={toggleSort}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleSort();
                }
              }}
              title="Doble clic para ordenar por expediente"
              className={`mb-1 flex cursor-pointer select-none items-center gap-1 px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
                sortDir ? "text-cyan-400" : "text-zinc-500"
              }`}
            >
              Expediente
              {sortDir === "asc" ? (
                <ArrowUp className="h-3 w-3" aria-label="Orden ascendente" />
              ) : null}
              {sortDir === "desc" ? (
                <ArrowDown
                  className="h-3 w-3"
                  aria-label="Orden descendente"
                />
              ) : null}
            </div>
            <ul className="max-h-48 space-y-0.5 overflow-y-auto">
              {displayed.map((v) => (
                <li key={v.id}>
                  <PuertoLibreSwipeDeleteExpediente
                    vehiculoId={v.id}
                    codigo={v.codigo}
                  >
                    <div className="flex items-center rounded-xl px-2 py-1.5 transition hover:bg-zinc-900/50">
                      <Link
                        href={v.href}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-1 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="smartimport-expediente-title inline-block whitespace-nowrap font-mono text-zinc-300">
                            {v.codigo}
                          </span>
                          <span className="smartimport-vehiculo-description mt-0.5 block truncate">
                            {v.vehiculo}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
                      </Link>
                    </div>
                  </PuertoLibreSwipeDeleteExpediente>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
