/**
 * Colas del dashboard Puerto Libre.
 * Un expediente puede estar en SENIAT y en su etapa de planilla a la vez;
 * no debe repetirse en "Pendiente a completar" si ya tiene cubo propio (1–3).
 */

export type DashboardClasificacionFuente = {
  planillaFase: number | null;
  fechaIngreso?: string | null;
  fechaPresentacionSeniat?: string | null;
  estadoSeniat?: string | null;
  estadoNacionalizacion?: string | null;
  completitudDatos?: "rojo" | "ambar" | "verde" | null;
};

function faseDe(v: DashboardClasificacionFuente): number {
  const f = v.planillaFase;
  if (f == null || !Number.isFinite(f) || f < 1) return 1;
  return f;
}

function tieneFecha(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

/** Fase 1: falta guardar registro (factura + certificado + planilla). */
export function esPorCompletarRegistro(v: DashboardClasificacionFuente): boolean {
  return faseDe(v) === 1 && !tieneFecha(v.fechaIngreso);
}

/** Fase 2: BL / lista de empaque / póliza de la carga. */
export function esPorCargarDocsCarga(v: DashboardClasificacionFuente): boolean {
  return faseDe(v) === 2 && !tieneFecha(v.fechaIngreso);
}

/** Fase 3: llegada a puerto, sin fecha de ingreso. */
export function esPorRecibirEnPuerto(v: DashboardClasificacionFuente): boolean {
  return faseDe(v) === 3 && !tieneFecha(v.fechaIngreso);
}

/**
 * Etapas 4–7 (desaduanamiento, propietario, seguro, matrícula).
 * No incluye registro / carga / puerto: esas tienen cubo propio.
 */
export function esPendientePlanillaRestante(
  v: DashboardClasificacionFuente
): boolean {
  const f = faseDe(v);
  return f >= 4 && f < 8;
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
