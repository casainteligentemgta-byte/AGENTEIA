import { ExternalLink } from "lucide-react";
import {
  badgeContadorLlegada,
  diasHastaLlegadaBuque,
  etiquetaLlegadaBuque,
  resolveBuqueTracking,
} from "@/lib/importacion/buque-tracking";

type Props = {
  numeroBl?: string | null;
  fechaLlegadaBuque?: string | null;
  compact?: boolean;
  /** Si false, solo el enlace (el contador va en el botón del BL). */
  showCountdown?: boolean;
};

export function BuqueLlegadaBadge({
  fechaLlegadaBuque,
}: {
  fechaLlegadaBuque?: string | null;
}) {
  const dias = diasHastaLlegadaBuque(fechaLlegadaBuque);
  const badge = badgeContadorLlegada(dias);
  if (!badge) return null;
  const label = etiquetaLlegadaBuque(dias);
  return (
    <span
      title={label ?? undefined}
      aria-label={label ?? undefined}
      className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-bold tabular-nums sm:text-sm ${
        dias != null && dias < 0
          ? "border-amber-700/60 bg-amber-950/50 text-amber-200"
          : dias === 0
            ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-200"
            : "border-cyan-600/70 bg-cyan-900/70 text-cyan-100"
      }`}
    >
      {badge}
    </span>
  );
}

export function BuqueTrackingChip({
  numeroBl,
  fechaLlegadaBuque,
  compact = false,
  showCountdown = true,
}: Props) {
  const tracking = resolveBuqueTracking({ numeroBl, fechaLlegadaBuque });
  if (!tracking) return null;

  return (
    <div
      className={
        compact
          ? "mt-1 flex flex-wrap items-center gap-x-2 gap-y-1"
          : "mt-2 flex flex-wrap items-center gap-2"
      }
    >
      {showCountdown ? (
        tracking.llegadaLabel ? (
          <span
            className={`tabular-nums ${
              tracking.dias != null && tracking.dias < 0
                ? "text-amber-300"
                : "text-cyan-200"
            } ${compact ? "text-[11px] font-medium" : "text-xs font-semibold"}`}
          >
            {tracking.llegadaLabel}
          </span>
        ) : (
          <span className={compact ? "text-[11px] text-zinc-500" : "text-xs text-zinc-500"}>
            Sin fecha de llegada
          </span>
        )
      ) : null}
      <a
        href={tracking.trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-100 ${
          compact ? "text-[11px]" : "text-xs font-medium"
        }`}
      >
        <ExternalLink className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        Ubicar buque
        {tracking.navieraNombre ? ` · ${tracking.navieraNombre}` : ""}
      </a>
    </div>
  );
}
