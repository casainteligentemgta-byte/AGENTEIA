import type { ComponentType } from "react";
import {
  Battery,
  CircleDot,
  Droplets,
  Shield,
  Wrench,
} from "lucide-react";
import { getBrand } from "@/lib/brand";
import { getJacServiceTheme } from "@/lib/brand/jac-theme";
import type { EstadoCategoriaValue } from "@/lib/schemas/categoria-vehiculo";
import { formatEstadoSalud } from "@/lib/vehicles/vehicle-health";
import { JAC_STATUS } from "@/lib/brand/jac-theme";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  aceite: Droplets,
  neumaticos: CircleDot,
  cauchos: CircleDot,
  frenos: Shield,
  bateria: Battery,
  alineacion: Wrench,
  fluidos: Droplets,
  general: Wrench,
};

type JacServiceCardProps = {
  id: string;
  label?: string;
  estado: EstadoCategoriaValue | null;
  progress?: number;
  alertBar?: boolean;
  hint?: string | null;
};

export function JacServiceCard({
  id,
  label,
  estado,
  progress = 0,
  alertBar,
  hint,
}: JacServiceCardProps) {
  const copy = getBrand().copy;
  const theme = getJacServiceTheme(id);
  const Icon = ICONS[id] ?? Wrench;
  const title =
    label ??
    copy.categories[id as keyof typeof copy.categories] ??
    id;
  const statusColor =
    estado === "bien"
      ? JAC_STATUS.bien.color
      : estado === "atencion"
        ? JAC_STATUS.atencion.color
        : estado === "critico"
          ? JAC_STATUS.critico.color
          : "#6a6a74";
  const barColor =
    alertBar && "barAlert" in theme ? theme.barAlert : "bar" in theme ? theme.bar : theme.fg;

  return (
    <article className="jac-card p-3.5">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: theme.bg, color: theme.fg }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="jac-title mt-3 text-[15px] text-[#1c1c22]">{title}</p>
      <p className="mt-1 text-[13px] font-semibold" style={{ color: statusColor }}>
        {formatEstadoSalud(estado)}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-[#6a6a74]">{hint}</p> : null}
      <div className="jac-progress mt-3">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: barColor }}
        />
      </div>
    </article>
  );
}
