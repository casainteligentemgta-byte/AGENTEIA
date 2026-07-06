export type PrioridadAlerta = "critico" | "atencion" | "normal";

const DIAS_ATENCION_ALERTA = 7;

export function diasHastaFecha(fechaIso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(fechaIso);
  fecha.setHours(0, 0, 0, 0);
  return Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

export function prioridadDesdeFecha(fechaIso: string): {
  prioridad: PrioridadAlerta;
  diasRestantes: number;
} {
  const diasRestantes = diasHastaFecha(fechaIso);
  if (diasRestantes < 0) {
    return { prioridad: "critico", diasRestantes };
  }
  if (diasRestantes <= DIAS_ATENCION_ALERTA) {
    return { prioridad: "atencion", diasRestantes };
  }
  return { prioridad: "normal", diasRestantes };
}

const ORDEN_PRIORIDAD: Record<PrioridadAlerta, number> = {
  critico: 3,
  atencion: 2,
  normal: 1,
};

export function compararAlertasPorPrioridad(
  a: { prioridad: PrioridadAlerta; fecha_programada: string },
  b: { prioridad: PrioridadAlerta; fecha_programada: string }
): number {
  const diff = ORDEN_PRIORIDAD[b.prioridad] - ORDEN_PRIORIDAD[a.prioridad];
  if (diff !== 0) return diff;
  return a.fecha_programada.localeCompare(b.fecha_programada);
}
