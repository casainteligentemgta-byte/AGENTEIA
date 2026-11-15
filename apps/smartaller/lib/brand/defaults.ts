import type { BrandMaintenanceSchedule } from "@/lib/brand/types";

/**
 * Intervalos actuales de SmartTaller.
 * TODO(jac): sustituir por los de fábrica cuando JAC los entregue.
 */
export const DEFAULT_MAINTENANCE_SCHEDULE: BrandMaintenanceSchedule = {
  source: "default-smarttaller",
  nextService: { km: 5000, months: 6 },
  health: {
    kmAtencion: 5000,
    kmCritico: 7500,
    diasAtencion: 30,
  },
  byModule: {
    aceite: { km: 5000, months: 6 },
    neumaticos: { km: 5000 },
    balanceo: { km: 5000 },
    rotacion: { km: 5000 },
    alineacion: { km: 5000 },
    bateria: { km: 5000 },
    fluidos: { km: 5000 },
    cadena: { km: 5000 },
    frenos: { km: 5000 },
    hidraulico: { km: 5000 },
    filtros: { km: 5000 },
    orugas: { km: 5000 },
  },
  byModel: {},
};
