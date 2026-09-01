/**
 * Colas del dashboard Puerto Libre.
 * Planilla: una cola por fase 1–8. La 9 ya está completa.
 * Extraer → Registrar persiste planillaFase 2 (Por completar embarque).
 * Si el registro ya está listo (chip verde / semáforo verde) y la BD
 * sigue en fase 1 (alta suelta), la cola visible es embarque.
 * SENIAT y nacionalización son relojes aparte (pueden coincidir con una etapa).
 */

export type DashboardClasificacionFuente = {
  planillaFase: number | null;
  fechaIngreso?: string | null;
  fechaPresentacionSeniat?: string | null;
  estadoSeniat?: string | null;
  estadoNacionalizacion?: string | null;
  completitudDatos?: "rojo" | "ambar" | "verde" | null;
  /** Chip verde de Registro en la planilla. */
  registroCompleto?: boolean;
  /** Nº BL: la carga se queda en embarque y se duplica en llegada. */
  numeroBl?: string | null;
};

export const PLANILLA_FASES_PENDIENTES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type PlanillaFasePendiente = (typeof PLANILLA_FASES_PENDIENTES)[number];

function faseDe(v: DashboardClasificacionFuente): number {
  const f = v.planillaFase;
  if (f == null || !Number.isFinite(f) || f < 1) return 1;
  return f;
}

function tieneFecha(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Registro listo: chip verde o semáforo verde de datos del vehículo. */
export function esRegistroListoParaEmbarque(
  v: DashboardClasificacionFuente
): boolean {
  if (v.registroCompleto === true) return true;
  if (v.completitudDatos === "verde") return true;
  return false;
}

/**
 * Cola visible: si el registro ya está lleno, pasa a embarque
 * aunque la BD siga en fase 1.
 */
export function faseColaPlanilla(v: DashboardClasificacionFuente): number {
  const f = faseDe(v);
  if (f >= 9) return f;
  if (f <= 1 && esRegistroListoParaEmbarque(v)) return 2;
  return f;
}

/** Cola de planilla: el expediente está en esa etapa (1–8). */
export function esPorCompletarEtapa(
  v: DashboardClasificacionFuente,
  etapa: PlanillaFasePendiente
): boolean {
  const f = faseColaPlanilla(v);
  if (f < 1 || f > 8) return false;
  return f === etapa;
}

export function esPorCompletarRegistro(v: DashboardClasificacionFuente): boolean {
  return esPorCompletarEtapa(v, 1);
}

export function tieneBlGuardado(v: { numeroBl?: string | null }): boolean {
  return Boolean(v.numeroBl?.trim());
}

/**
 * Embarque: pendientes de fase 2, o BL ya guardado que pasó a llegada.
 * El original se queda en esta lista; un duplicado va a la cola de llegada.
 */
export function esEnColaEmbarque(v: DashboardClasificacionFuente): boolean {
  const f = faseColaPlanilla(v);
  if (f === 2) return true;
  return f === 3 && tieneBlGuardado(v);
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
  return faseColaPlanilla(v) >= 3;
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

/** Foto de placa + título listos (o ya cerró la planilla). */
export function esEntregaPlacaListaEnDashboard(v: {
  planillaFase?: number | null;
  entregaPlacaCompleta?: boolean;
}): boolean {
  const fase = v.planillaFase;
  if (typeof fase === "number" && fase >= 9) return true;
  return v.entregaPlacaCompleta === true;
}

export function placaAccionLabel(completo: boolean): string {
  return completo ? "Placa completada" : "Completar placa";
}
