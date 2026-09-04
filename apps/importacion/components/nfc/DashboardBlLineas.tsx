"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BuqueTrackingChip } from "@/components/nfc/BuqueTrackingChip";
import { blLineasToggleLabel } from "@/lib/importacion/dashboard-cola-bl";

export type DashboardBucketLinea = {
  href: string;
  titulo: string;
  detalle?: string;
};

type Props = {
  blLabel: string;
  href: string;
  lineas: DashboardBucketLinea[];
  resumen?: string;
  titleClassName: string;
  numeroBl?: string | null;
  fechaLlegadaBuque?: string | null;
};

export function DashboardBlLineas({
  blLabel,
  href,
  lineas,
  resumen,
  titleClassName,
  numeroBl,
  fechaLlegadaBuque,
}: Props) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const count = lineas.length;
  const label = blLineasToggleLabel(open, count);

  return (
    <div
      className={
        open
          ? "space-y-2"
            : "min-w-0 rounded-xl border border-cyan-800/50 bg-cyan-950/25 px-3 py-2.5"
      }
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <Link
          href={href}
          className={
            open
              ? `${titleClassName} block min-w-0`
              : `${titleClassName} block min-w-0 text-base font-semibold text-cyan-200 hover:text-cyan-100 sm:text-lg`
          }
        >
          {blLabel}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={listId}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-700/50 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:border-cyan-500/60 hover:text-cyan-100"
        >
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
          {label}
        </button>
      </div>
      <BuqueTrackingChip
        numeroBl={numeroBl ?? blLabel.replace(/^BL\s+/i, "")}
        fechaLlegadaBuque={fechaLlegadaBuque}
        compact
      />

      {open ? (
        <>
          <ul id={listId} className="space-y-1.5">
            {lineas.map((linea) => (
              <li key={linea.href}>
                <Link
                  href={linea.href}
                  className="block rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-2.5 py-1.5 hover:border-cyan-700/40"
                >
                  <span className="font-mono text-xs tracking-wide text-zinc-100">
                    {linea.titulo}
                  </span>
                  {linea.detalle ? (
                    <span className="mt-0.5 block text-[11px] text-zinc-400">
                      {linea.detalle}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {resumen ? (
            <p className="text-[11px] text-zinc-500">{resumen}</p>
          ) : null}
        </>
      ) : (
        <p id={listId} className="mt-1 text-xs text-zinc-400">
          {count} expediente{count === 1 ? "" : "s"} en esta carga
        </p>
      )}
    </div>
  );
}
