import {
  PL_NACIONALIZACION_M2_TIPOS,
  PL_NACIONALIZACION_M3_TIPOS,
  VIA_NACIONALIZACION_LABELS,
  type DocumentoTipo,
  type ImportacionData,
  type VehiculosDocumentos,
  type ViaNacionalizacion,
} from "@/lib/schemas/vehiculo-documentos";

/** Años completos desde fecha ISO YYYY-MM-DD hasta hoy. */
export function aniosDesdeFecha(fecha: string | null | undefined): number | null {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) return null;
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const start = new Date(y, m - 1, d);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const beforeAnniversary =
    now.getMonth() < start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

/** Fecha límite = ingreso + 3 años (umbral de permanencia). */
export function fechaLimitePermanencia3Anios(
  fechaIngreso: string | null | undefined
): string | null {
  if (!fechaIngreso || !/^\d{4}-\d{2}-\d{2}/.test(fechaIngreso)) return null;
  const [y, m, d] = fechaIngreso.slice(0, 10).split("-").map(Number);
  const date = new Date(y + 3, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Sugiere vía según años en PL desde fecha de ingreso.
 * < 3 → cambio de régimen; ≥ 3 → permanencia.
 */
export function sugerirViaNacionalizacion(
  importacion: ImportacionData
): ViaNacionalizacion {
  const anios = aniosDesdeFecha(
    importacion.fechaLiquidacion ?? importacion.fechaIngreso
  );
  if (anios != null && anios >= 3) return "permanencia";
  return "cambio_regimen";
}

export function docsTiposPorVia(via: ViaNacionalizacion): DocumentoTipo[] {
  return via === "permanencia"
    ? PL_NACIONALIZACION_M3_TIPOS
    : PL_NACIONALIZACION_M2_TIPOS;
}

export function docsFaltantesNacionalizacion(
  docs: VehiculosDocumentos,
  via: ViaNacionalizacion
): DocumentoTipo[] {
  return docsTiposPorVia(via).filter((t) => !docs[t]?.url);
}

export function viaLabel(via: ViaNacionalizacion): string {
  return VIA_NACIONALIZACION_LABELS[via];
}

export function descripcionVia(via: ViaNacionalizacion): string {
  if (via === "permanencia") {
    return "Vehículo con 3+ años continuos en Puerto Libre. Se gestiona liberación con depreciación / tributo residual y levantamiento de reserva en el INTT.";
  }
  return "Salida a Tierra Firme antes de 3 años. Requiere declaración complementaria ante SENIAT, pago de diferencia de tributos y actualización del título a libre circulación.";
}
