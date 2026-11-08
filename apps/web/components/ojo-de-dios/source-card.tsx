import type { ReactNode } from "react";
import type { ProviderMeta, ProviderStatus } from "@/lib/ojo-de-dios/types";

const STATUS_LABEL: Record<ProviderStatus, string> = {
  ok: "Actualizado",
  needsAuth: "No conectado",
  error: "Error",
  unavailable: "No disponible",
  hidden: "Oculto",
};

const STATUS_CLASS: Record<ProviderStatus, string> = {
  ok: "border-emerald-800/60 bg-emerald-950/40 text-emerald-300",
  needsAuth: "border-zinc-700 bg-zinc-800/80 text-zinc-400",
  error: "border-amber-900/60 bg-amber-950/40 text-amber-200",
  unavailable: "border-zinc-700 bg-zinc-900 text-zinc-400",
  hidden: "border-zinc-800 bg-zinc-900 text-zinc-500",
};

function formatStamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SourceCard({
  meta,
  children,
}: {
  meta: ProviderMeta;
  children: ReactNode;
}) {
  const stamp = formatStamp(meta.fetchedAt);
  return (
    <section className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-xl">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{meta.label}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">{meta.sourceName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[meta.status]}`}
        >
          {STATUS_LABEL[meta.status]}
        </span>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-500">
        <span>{stamp ? `Consultado ${stamp}` : "Sin fecha de consulta"}</span>
        {meta.sourceUrl ? (
          <a
            href={meta.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-400 hover:text-blue-300"
          >
            Fuente
          </a>
        ) : null}
      </footer>
    </section>
  );
}
