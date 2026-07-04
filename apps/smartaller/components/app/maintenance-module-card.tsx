import {
  Battery,
  CircleDot,
  Droplets,
  Filter,
  Link2,
  RotateCw,
  Settings2,
  Shield,
  Wrench,
  Zap,
} from "lucide-react";
import type { ModuloMantenimiento } from "@/lib/vehicles/types";

const ICONOS: Record<string, React.ComponentType<{ className?: string }>> = {
  aceite: Droplets,
  neumaticos: CircleDot,
  balanceo: Settings2,
  rotacion: RotateCw,
  alineacion: Wrench,
  bateria: Battery,
  fluidos: Droplets,
  cadena: Link2,
  frenos: Shield,
  hidraulico: Zap,
  filtros: Filter,
  orugas: Settings2,
};

type MaintenanceModuleCardProps = {
  modulo: ModuloMantenimiento;
  visitasRegistradas?: number;
};

export function MaintenanceModuleCard({
  modulo,
  visitasRegistradas = 0,
}: MaintenanceModuleCardProps) {
  const Icon = ICONOS[modulo.id] ?? Wrench;
  const pendiente =
    modulo.disponibleDesdeVisita != null && visitasRegistradas < modulo.disponibleDesdeVisita;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900">{modulo.label}</p>
          {pendiente ? (
            <div className="mt-2 space-y-1 text-sm text-zinc-400">
              <p className="border-b border-dashed border-zinc-200 pb-2">
                Disponible después del 1er {modulo.label.toLowerCase()}
              </p>
              <p>Disponible en la {modulo.disponibleDesdeVisita}ª visita al taller</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Conecta con tu taller para ver historial y próximos servicios
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
