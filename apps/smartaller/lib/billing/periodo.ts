export const PERIODO_DIAS = 30;
export const AVISO_DIAS_VENCIMIENTO = [7, 3] as const;

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function diasRestantesVencimiento(
  vencimiento: string | Date | null | undefined,
  now = new Date()
): number | null {
  if (!vencimiento) return null;
  const fin = typeof vencimiento === "string" ? new Date(vencimiento) : vencimiento;
  if (Number.isNaN(fin.getTime())) return null;
  return Math.ceil((fin.getTime() - now.getTime()) / 86_400_000);
}

export function suscripcionEstaVigente(
  activa: boolean,
  vencimiento: string | Date | null | undefined,
  now = new Date()
): boolean {
  if (!activa) return false;
  if (!vencimiento) return true;
  const fin = typeof vencimiento === "string" ? new Date(vencimiento) : vencimiento;
  if (Number.isNaN(fin.getTime())) return false;
  return fin.getTime() > now.getTime();
}

/**
 * Aprueba un mes: si el plan sigue vigente, extiende desde el vencimiento actual;
 * si no, empieza ahora.
 */
export function calcularPeriodoRenovacion(
  vencimientoActual: string | Date | null | undefined,
  now = new Date(),
  dias = PERIODO_DIAS
): { inicio: Date; fin: Date } {
  const actual =
    typeof vencimientoActual === "string"
      ? new Date(vencimientoActual)
      : vencimientoActual ?? null;
  const base =
    actual && !Number.isNaN(actual.getTime()) && actual.getTime() > now.getTime()
      ? actual
      : now;
  return { inicio: now, fin: addDays(base, dias) };
}

export function vencimientoCerca(
  vencimiento: string | Date | null | undefined,
  now = new Date(),
  umbralDias = 7
): boolean {
  const dias = diasRestantesVencimiento(vencimiento, now);
  return dias != null && dias >= 0 && dias <= umbralDias;
}
