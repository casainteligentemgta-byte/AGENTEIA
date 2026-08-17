import type { ModuloMantenimiento } from "@/lib/vehicles/types";
import type { MantenimientoHistorial, RecordatorioUsuario } from "@/lib/data/vehicle-history";
import { PALABRAS_MODULO } from "@/lib/vehicles/module-keywords";
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

const KM_PROXIMO_DEFAULT = 5000;

function buscarUltimoServicioModulo(
  moduloId: string,
  historial: MantenimientoHistorial[]
): MantenimientoHistorial | null {
  const palabras = PALABRAS_MODULO[moduloId] ?? [moduloId];
  for (const m of historial) {
    const texto = (m.descripcion ?? "").toLowerCase();
    if (palabras.some((p) => texto.includes(p))) return m;
  }
  return null;
}

function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(iso));
}

function calcularProgreso(ultimoKm: number | null, actualKm: number | null): number {
  if (ultimoKm == null || actualKm == null) return 0;
  const diff = actualKm - ultimoKm;
  return Math.min(100, Math.max(0, Math.round((diff / KM_PROXIMO_DEFAULT) * 100)));
}

type MaintenanceModuleCardProps = {
  modulo: ModuloMantenimiento;
  visitasRegistradas?: number;
  historial?: MantenimientoHistorial[];
  kmActual?: number | null;
  proximoRecordatorio?: RecordatorioUsuario | null;
};

export function MaintenanceModuleCard({
  modulo,
  visitasRegistradas = 0,
  historial = [],
  kmActual = null,
  proximoRecordatorio = null,
}: MaintenanceModuleCardProps) {
  const Icon = ICONOS[modulo.id] ?? Wrench;
  const pendiente =
    modulo.disponibleDesdeVisita != null && visitasRegistradas < modulo.disponibleDesdeVisita;
  const ultimo = buscarUltimoServicioModulo(modulo.id, historial);

  const proxKm =
    proximoRecordatorio?.kilometraje_objetivo ??
    (ultimo?.kilometraje != null ? ultimo.kilometraje + KM_PROXIMO_DEFAULT : null);
  const proxFecha = proximoRecordatorio?.fecha_programada ?? null;
  const progreso = calcularProgreso(ultimo?.kilometraje ?? null, kmActual);

  return (
    <div className="app-card-white relative p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-50 text-zinc-700">
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-zinc-900">{modulo.label}</p>

          {pendiente ? (
            <div className="mt-3 space-y-2 text-sm text-zinc-400">
              <div className="grid grid-cols-2 gap-2 border-b border-dashed border-zinc-200 pb-3">
                <div>
                  <p className="text-xs text-zinc-400">Últ. cambio</p>
                  <p className="mt-1 text-zinc-300">—</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Próx. cambio</p>
                  <p className="mt-1 text-zinc-300">—</p>
                </div>
              </div>
              <p>Disponible después del 1er {modulo.label.toLowerCase()}</p>
              <p className="text-xs">Disponible en la {modulo.disponibleDesdeVisita}ª visita</p>
            </div>
          ) : ultimo ? (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Últ. cambio</p>
                  {ultimo.kilometraje != null && (
                    <p className="font-semibold text-zinc-800">
                      {ultimo.kilometraje.toLocaleString("es-CO")}km
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">{formatFechaCorta(ultimo.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Próx. cambio</p>
                  {proxKm != null && (
                    <p className="font-semibold text-zinc-800">
                      {proxKm.toLocaleString("es-CO")}km
                    </p>
                  )}
                  {proxFecha && (
                    <p className="text-xs text-zinc-500">{formatFechaCorta(proxFecha)}</p>
                  )}
                </div>
              </div>
              {kmActual != null && (
                <div className="mt-3 space-y-1">
                  <div className="app-progress-track">
                    <div className="app-progress-fill" style={{ width: `${progreso}%` }} />
                  </div>
                </div>
              )}
            </div>
          ) : visitasRegistradas > 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              {visitasRegistradas} visita(s). Sin detalle de {modulo.label.toLowerCase()}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              Visita un centro de servicio para registrar datos
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
