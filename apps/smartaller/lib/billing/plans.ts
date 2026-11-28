export const TIPOS_PLAN_PAGO = ["b2c", "taller"] as const;
export type TipoPlanPago = (typeof TIPOS_PLAN_PAGO)[number];

export const MONEDAS_PAGO = ["USD", "VES"] as const;
export type MonedaPago = (typeof MONEDAS_PAGO)[number];

export const ESTADOS_REPORTE_PAGO = [
  "pendiente",
  "aprobado",
  "rechazado",
  "cancelado",
] as const;
export type EstadoReportePago = (typeof ESTADOS_REPORTE_PAGO)[number];

export const TIPOS_EXONERACION = ["perfil", "taller_clientes", "taller"] as const;
export type TipoExoneracion = (typeof TIPOS_EXONERACION)[number];

export const PLANES_PAGO = {
  b2c: {
    id: "b2c" as const,
    nombre: "SmartTaller Pro",
    usdPorMes: 2.99,
    periodoDias: 30,
    descripcion: "Dueños independientes: historial, recordatorios y chat.",
  },
  taller: {
    id: "taller" as const,
    nombre: "SmartTaller Taller",
    usdPorMes: 100,
    periodoDias: 30,
    descripcion: "Dashboard del taller, órdenes, flota y avisos a clientes.",
  },
} as const;

export function isTipoPlanPago(value: string): value is TipoPlanPago {
  return (TIPOS_PLAN_PAGO as readonly string[]).includes(value);
}

export function usdDelPlan(tipo: TipoPlanPago): number {
  return PLANES_PAGO[tipo].usdPorMes;
}

export function vesDelPlan(usd: number, tasaBcv: number): number {
  return Math.round(usd * tasaBcv * 100) / 100;
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatVes(amount: number): string {
  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "VES",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
