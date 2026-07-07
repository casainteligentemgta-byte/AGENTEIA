import type { BikeComponentStatus } from "@/lib/bicicopilot/types";

/** Umbral de alerta amarilla (80% vida útil consumida). */
export const WEAR_WARNING_RATIO = 0.8;

/** Umbral crítico (95% vida útil consumida). */
export const WEAR_CRITICAL_RATIO = 0.95;

export function wearRatio(kmAccumulated: number, kmLimit: number): number {
  if (kmLimit <= 0) return 0;
  return kmAccumulated / kmLimit;
}

export function wearPercent(kmAccumulated: number, kmLimit: number): number {
  return Math.min(100, Math.round(wearRatio(kmAccumulated, kmLimit) * 100));
}

export function statusFromWear(
  kmAccumulated: number,
  kmLimit: number
): BikeComponentStatus {
  const ratio = wearRatio(kmAccumulated, kmLimit);
  if (ratio >= WEAR_CRITICAL_RATIO) return "red";
  if (ratio >= WEAR_WARNING_RATIO) return "yellow";
  return "green";
}

export const STATUS_STYLES: Record<
  BikeComponentStatus,
  { bar: string; badge: string; label: string }
> = {
  green: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700",
    label: "Bien",
  },
  yellow: {
    bar: "bg-amber-500",
    badge: "bg-amber-500/15 text-amber-800",
    label: "Atención",
  },
  red: {
    bar: "bg-red-500",
    badge: "bg-red-500/15 text-red-700",
    label: "Sustituir",
  },
};
