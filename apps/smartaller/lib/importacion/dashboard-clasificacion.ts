/**
 * Colas del dashboard Puerto Libre.
 * Planilla: una cola por fase 1–7. La 8 ya está completa.
 * SENIAT y nacionalización son relojes aparte (pueden coincidir con una etapa).
 */

export type DashboardClasificacionFuente = {
  planillaFase: number | null;
  fechaIngreso?: string | null;
  fechaPresentacionSeniat?: string | null;
  estadoSeniat?: string | null;
  estadoNacionalizacion?: string | null;
  completitudDatos?: "rojo" | "ambar" | "verde" | null;
};

export const PLANILLA_FASES_PENDIENTES = [1, 2, 3, 4, 5, 6, 7] as const;

export type PlanillaFasePendiente = (typeof PLANILLA_FASES_PENDIENTES)[number];

function faseDe(v: DashboardClasificacionFuente): number {
  const f = v.planillaFase;
  if (f == null || !Number.isFinite(f) || f < 1) return 1;
  return f;
}

function tieneFecha(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Cola de planilla: el expediente está en esa etapa (1–7). */
export function esPorCompletarEtapa(
  v: DashboardClasificacionFuente,
  etapa: PlanillaFasePendiente
): boolean {
  return faseDe(v) === etapa;
}

export function esPorCompletarRegistro(v: DashboardClasificacionFuente): boolean {
  return esPorCompletarEtapa(v, 1);
}

/**
 * SENIAT pendiente o agendada, solo desde llegada (o si ya hay cita/ingreso).
 * No mete aquí los autos recién extraídos en registro.
 */
export function esPorPresentacionSeniat(v: DashboardClasificacionFuente): boolean {
  const estado = (v.estadoSeniat ?? "pendiente").trim().toLowerCase();
  if (estado !== "pendiente" && estado !== "agendada") return false;
  if (tieneFecha(v.fechaPresentacionSeniat) || tieneFecha(v.fechaIngreso)) {
    return true;
  }
  return faseDe(v) >= 3;
}

export function esRechazadoSeniat(v: DashboardClasificacionFuente): boolean {
  return (v.estadoSeniat ?? "pendiente").trim().toLowerCase() === "rechazada";
}

export function esNacionalizado(v: DashboardClasificacionFuente): boolean {
  return (v.estadoNacionalizacion ?? "").trim().toLowerCase() === "nacionalizado";
}

/** Extraer ya dejó datos: el operador confirma la planilla, no "falta el auto". */
export function registroAccionLabel(
  completitud: DashboardClasificacionFuente["completitudDatos"]
): string {
  return completitud === "verde" ? "Confirmar registro" : "Completar registro";
}
