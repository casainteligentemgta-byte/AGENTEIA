import type { ReactNode } from "react";
import type { ProviderMeta, ProviderStatus } from "@/lib/ojo-de-dios/types";

const STATUS_LABEL: Record<ProviderStatus, string> = {
  ok: "Actualizado",
  needsAuth: "No conectado",
  error: "Error",
  unavailable: "No disponible",
  hidden: "No conectado",
};

const STATUS_CLASS: Record<ProviderStatus, string> = {
  ok: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  needsAuth: "border-white/10 bg-white/5 text-white/55",
  error: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  unavailable: "border-white/10 bg-white/5 text-white/55",
  hidden: "border-white/10 bg-white/5 text-white/55",
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
  id,
  className = "",
  children,
}: {
  meta: ProviderMeta;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const stamp = formatStamp(meta.fetchedAt);
  const displayStatus = meta.status === "hidden" ? "needsAuth" : meta.status;

  return (
    <section
      id={id}
      className={`ojo-card flex h-full min-h-[12rem] flex-col rounded-3xl border border-cyan-400/15 bg-white/[0.04] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-md md:p-6 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-white">{meta.label}</h2>
          <p className="mt-0.5 text-sm text-white/55">{meta.sourceName}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_CLASS[displayStatus]}`}
        >
          {STATUS_LABEL[displayStatus]}
        </span>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-white/45">
        <span>{stamp ? `Consultado ${stamp}` : "Sin fecha de consulta"}</span>
        {meta.sourceUrl ? (
          <a
            href={meta.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-cyan-300 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            Fuente
          </a>
        ) : null}
      </footer>
    </section>
  );
}
