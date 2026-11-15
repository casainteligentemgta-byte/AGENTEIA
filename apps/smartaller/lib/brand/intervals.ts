import { getBrand } from "@/lib/brand/config";
import type { MaintenanceInterval, ModuleInterval } from "@/lib/brand/types";

export function getNextServiceInterval(modelo?: string | null): MaintenanceInterval {
  const schedule = getBrand().maintenance;
  const fromModel = modelo?.trim() ? schedule.byModel[modelo.trim()]?.nextService : undefined;
  return fromModel ?? schedule.nextService;
}

export function getModuleInterval(
  moduleId: string,
  modelo?: string | null
): ModuleInterval {
  const schedule = getBrand().maintenance;
  const fromModel = modelo?.trim()
    ? schedule.byModel[modelo.trim()]?.byModule?.[moduleId]
    : undefined;
  return fromModel ?? schedule.byModule[moduleId] ?? { km: schedule.nextService.km };
}

export function getHealthThresholds() {
  return getBrand().maintenance.health;
}

export function kilometresUntilNextService(
  lastKm: number | null,
  actualKm: number | null,
  modelo?: string | null,
  moduleId?: string
): number | null {
  if (lastKm == null || actualKm == null) return null;
  const interval = moduleId
    ? getModuleInterval(moduleId, modelo)
    : getNextServiceInterval(modelo);
  return Math.max(0, interval.km - (actualKm - lastKm));
}
