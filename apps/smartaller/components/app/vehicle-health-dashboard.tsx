import {
  Battery,
  CircleDot,
  Droplets,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EstadoCategoriaValue } from "@/lib/schemas/categoria-vehiculo";
import {
  formatEstadoSalud,
  type CategoriaSaludResumen,
  type VehicleHealthSummary,
} from "@/lib/vehicles/vehicle-health";
import type { CategoriaVehiculoId } from "@/lib/schemas/categoria-vehiculo";
import { cn } from "@/lib/utils";

const ICONOS: Record<CategoriaVehiculoId, React.ComponentType<{ className?: string }>> = {
  bateria: Battery,
  neumaticos: CircleDot,
  aceite: Droplets,
  general: Wrench,
};

const ESTILO_ESTADO: Record<
  EstadoCategoriaValue,
  { dot: string; ring: string; badge: "success" | "warning" | "danger" }
> = {
  bien: {
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/25",
    badge: "success",
  },
  atencion: {
    dot: "bg-amber-500",
    ring: "ring-amber-500/25",
    badge: "warning",
  },
  critico: {
    dot: "bg-red-500",
    ring: "ring-red-500/25",
    badge: "danger",
  },
};

function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function CategoriaCard({ categoria }: { categoria: CategoriaSaludResumen }) {
  const Icon = ICONOS[categoria.id];
  const estado = categoria.estado;
  const estilo = estado != null ? ESTILO_ESTADO[estado] : null;

  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-white p-3.5 shadow-sm transition",
        estado != null && estilo ? `ring-2 ${estilo.ring} border-transparent` : "border-zinc-100"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-600">
          <Icon className="h-5 w-5" />
        </div>
        {estado != null && estilo ? (
          <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", estilo.dot)} />
        ) : (
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-zinc-200" />
        )}
      </div>

      <p className="mt-3 text-sm font-bold text-zinc-900">{categoria.label}</p>

      <div className="mt-1.5">
        {estado != null && estilo ? (
          <Badge variant={estilo.badge}>{formatEstadoSalud(estado)}</Badge>
        ) : (
          <span className="text-xs font-medium text-zinc-400">Sin datos</span>
        )}
      </div>

      {categoria.fechaRevision && (
        <p className="mt-2 text-[11px] text-zinc-500">
          {categoria.id === "general" ? "Próxima: " : "Últ. revisión: "}
          {formatFechaCorta(categoria.fechaRevision)}
        </p>
      )}

      {categoria.notas && (
        <p className="mt-1 truncate text-[11px] text-zinc-400">{categoria.notas}</p>
      )}
    </div>
  );
}

type VehicleHealthDashboardProps = {
  salud: VehicleHealthSummary;
  tituloVehiculo?: string;
};

export function VehicleHealthDashboard({ salud, tituloVehiculo }: VehicleHealthDashboardProps) {
  const resumenGlobal = salud.peorEstado
    ? formatEstadoSalud(salud.peorEstado)
    : "Sin evaluar";

  const badgeVariant =
    salud.peorEstado === "critico"
      ? "danger"
      : salud.peorEstado === "atencion"
        ? "warning"
        : salud.peorEstado === "bien"
          ? "success"
          : "default";

  return (
    <section className="app-card-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">Estado del vehículo</h2>
          {tituloVehiculo && (
            <p className="text-xs text-zinc-500">{tituloVehiculo}</p>
          )}
        </div>
        <Badge variant={badgeVariant}>{resumenGlobal}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        {salud.categorias.map((categoria) => (
          <CategoriaCard key={categoria.id} categoria={categoria} />
        ))}
      </div>

      {salud.recordatoriosUrgentes > 0 && (
        <div className="border-t border-amber-100 bg-amber-50/80 px-4 py-2.5 text-center text-xs font-medium text-amber-800">
          {salud.recordatoriosUrgentes} recordatorio(s) requieren atención
        </div>
      )}
    </section>
  );
}
