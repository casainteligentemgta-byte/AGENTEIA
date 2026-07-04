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
import type { MantenimientoHistorial } from "@/lib/data/vehicle-history";
import { formatDate } from "@/lib/utils";

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

const PALABRAS_MODULO: Record<string, string[]> = {
  aceite: ["aceite", "lubric", "oil"],
  neumaticos: ["neumático", "neumatico", "caucho", "llanta", "tire"],
  balanceo: ["balanceo", "balance"],
  rotacion: ["rotación", "rotacion"],
  alineacion: ["alineación", "alineacion"],
  bateria: ["batería", "bateria"],
  fluidos: ["fluido", "refrigerante", "freno"],
  cadena: ["cadena", "transmisión", "transmision"],
  frenos: ["freno", "pastilla", "disco"],
  hidraulico: ["hidráulico", "hidraulico"],
  filtros: ["filtro"],
  orugas: ["oruga", "tren de rodaje"],
};

function buscarUltimoServicioModulo(
  moduloId: string,
  historial: MantenimientoHistorial[]
): MantenimientoHistorial | null {
  const palabras = PALABRAS_MODULO[moduloId] ?? [moduloId];
  for (const m of historial) {
    const texto = `${m.descripcion ?? ""} ${m.descripcion_servicio ?? ""}`.toLowerCase();
    if (palabras.some((p) => texto.includes(p))) return m;
  }
  return null;
}

type MaintenanceModuleCardProps = {
  modulo: ModuloMantenimiento;
  visitasRegistradas?: number;
  historial?: MantenimientoHistorial[];
};

export function MaintenanceModuleCard({
  modulo,
  visitasRegistradas = 0,
  historial = [],
}: MaintenanceModuleCardProps) {
  const Icon = ICONOS[modulo.id] ?? Wrench;
  const pendiente =
    modulo.disponibleDesdeVisita != null && visitasRegistradas < modulo.disponibleDesdeVisita;
  const ultimo = buscarUltimoServicioModulo(modulo.id, historial);

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
          ) : ultimo ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-zinc-600">
                Últ. servicio: {formatDate(ultimo.created_at)}
                {ultimo.kilometraje != null &&
                  ` · ${ultimo.kilometraje.toLocaleString("es-CO")} km`}
              </p>
              {ultimo.taller_nombre && (
                <p className="text-xs text-zinc-400">{ultimo.taller_nombre}</p>
              )}
            </div>
          ) : visitasRegistradas > 0 ? (
            <p className="mt-1 text-sm text-zinc-500">
              {visitasRegistradas} visita(s) registrada(s). Sin detalle específico de{" "}
              {modulo.label.toLowerCase()}.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">
              Sin datos del taller. Visita un centro de servicio vinculado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
