import Link from "next/link";
import { AlertTriangle, CalendarClock, Timer } from "lucide-react";
import {
  buildAlertaNacionalizacion,
  type AlertaNacionalizacion,
  type UrgenciaNacionalizacion,
} from "@/lib/importacion/alerta-nacionalizacion";
import type { ImportacionData } from "@/lib/schemas/vehiculo-documentos";

const STYLES: Record<
  UrgenciaNacionalizacion,
  { box: string; icon: string; badge: string; badgeText: string }
> = {
  ok: {
    box: "border-cyan-900/40 bg-cyan-950/25",
    icon: "text-cyan-400",
    badge: "bg-cyan-950/80 text-cyan-200",
    badgeText: "En plazo",
  },
  aviso: {
    box: "border-amber-900/45 bg-amber-950/30",
    icon: "text-amber-400",
    badge: "bg-amber-950/80 text-amber-200",
    badgeText: "Aviso",
  },
  urgente: {
    box: "border-orange-800/50 bg-orange-950/35",
    icon: "text-orange-400",
    badge: "bg-orange-950/90 text-orange-100",
    badgeText: "Urgente",
  },
  hoy: {
    box: "border-red-800/55 bg-red-950/40",
    icon: "text-red-400",
    badge: "bg-red-900/80 text-red-100",
    badgeText: "Hoy",
  },
  vencido: {
    box: "border-red-700/60 bg-red-950/50",
    icon: "text-red-300",
    badge: "bg-red-800/90 text-red-50",
    badgeText: "Vencido",
  },
};

function Icono({ urgencia }: { urgencia: UrgenciaNacionalizacion }) {
  const cls = `h-5 w-5 shrink-0 ${STYLES[urgencia].icon}`;
  if (urgencia === "vencido" || urgencia === "hoy" || urgencia === "urgente") {
    return <AlertTriangle className={cls} aria-hidden />;
  }
  if (urgencia === "aviso") {
    return <Timer className={cls} aria-hidden />;
  }
  return <CalendarClock className={cls} aria-hidden />;
}

export function AlertaBanner({
  alerta,
  compact,
  href,
}: {
  alerta: Pick<AlertaNacionalizacion, "titulo" | "detalle" | "dias" | "urgencia">;
  compact?: boolean;
  href?: string;
}) {
  const style = STYLES[alerta.urgencia];
  const diasLabel =
    alerta.dias < 0
      ? `−${Math.abs(alerta.dias)} d`
      : alerta.dias === 0
        ? "0 d"
        : `${alerta.dias} d`;

  const inner = (
    <div className="flex items-start gap-3">
      <Icono urgencia={alerta.urgencia} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-50">{alerta.titulo}</p>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${style.badge}`}
          >
            {style.badgeText} · {diasLabel}
          </span>
        </div>
        {!compact ? (
          <p className="mt-1 text-xs leading-relaxed text-zinc-400 sm:text-sm">
            {alerta.detalle}
          </p>
        ) : null}
      </div>
    </div>
  );

  const className = `rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 ${style.box}`;

  if (href) {
    return (
      <Link
        href={href}
        className={`${className} block transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`}
        aria-label={`${alerta.titulo}. Abrir documentos.`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div role="status" aria-live="polite" className={className}>
      {inner}
    </div>
  );
}

type Props = {
  importacion: ImportacionData;
  /** Versión corta (solo título + badge). */
  compact?: boolean;
  href?: string;
};

/** Banner de días restantes para nacionalizar (umbral 3 años en PL). */
export function AlertaDiasNacionalizacion({ importacion, compact, href }: Props) {
  const alerta = buildAlertaNacionalizacion(importacion);
  if (!alerta) return null;
  return <AlertaBanner alerta={alerta} compact={compact} href={href} />;
}
