import { ExternalLink } from "lucide-react";
import { resolveBuqueTracking } from "@/lib/importacion/buque-tracking";

type Props = {
  numeroBl?: string | null;
  fechaLlegadaBuque?: string | null;
  compact?: boolean;
};

export function BuqueTrackingChip({
  numeroBl,
  fechaLlegadaBuque,
  compact = false,
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
      {tracking.llegadaLabel ? (
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
      )}
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
