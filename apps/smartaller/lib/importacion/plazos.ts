import {
  diasHasta,
  esProximoNacionalizar,
  esProximoSeniat,
  type ImportacionData,
  type PresentacionAnual,
} from "@/lib/schemas/vehiculo-documentos";

export type EstadoPresentacionAnual = "al_dia" | "atencion" | "vencido";

export type PlazosAduaneros = {
  fechaLiquidacion: string | null;
  fechaUltimaPresentacion: string | null;
  proximaFechaPresentacion: string | null;
  diasRestantesPresentacion: number | null;
  estadoPresentacion: EstadoPresentacionAnual | null;
  fechaElegibilidadNacionalizacion: string | null;
  diasRestantesNacionalizacion: number | null;
  elegibleNacionalizacion: boolean;
  progresoPermanenciaPct: number | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

export function parseIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

/** Suma años civiles a YYYY-MM-DD (maneja 29-feb). */
export function addYearsIso(
  fecha: string | null | undefined,
  years: number
): string | null {
  const iso = parseIsoDate(fecha);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y + years, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getMonth() !== m - 1) {
    date.setDate(0);
  }
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Liquidación SENIAT; si no hay, ingreso físico al PL. */
export function resolveFechaLiquidacion(
  data: Pick<ImportacionData, "fechaLiquidacion" | "fechaIngreso">
): string | null {
  return parseIsoDate(data.fechaLiquidacion) ?? parseIsoDate(data.fechaIngreso);
}

export function ultimaPresentacionValidada(
  historial: PresentacionAnual[] | null | undefined
): PresentacionAnual | null {
  if (!historial?.length) return null;
  const sorted = [...historial].sort((a, b) =>
    (parseIsoDate(a.fechaPresentacion) ?? "").localeCompare(
      parseIsoDate(b.fechaPresentacion) ?? ""
    )
  );
  return sorted[sorted.length - 1] ?? null;
}

export function estadoPresentacionDesdeDias(
  dias: number | null
): EstadoPresentacionAnual | null {
  if (dias == null) return null;
  if (dias < 0) return "vencido";
  if (dias <= 30) return "atencion";
  return "al_dia";
}

export const ESTADO_PRESENTACION_LABELS: Record<
  EstadoPresentacionAnual,
  string
> = {
  al_dia: "Al día",
  atencion: "Próximo a vencer",
  vencido: "Vencido / infracción",
};

/**
 * Plazos anuales (365 días / +1 año) y elegibilidad TAN (3 años)
 * desde fecha de liquidación.
 */
export function computePlazosAduaneros(data: ImportacionData): PlazosAduaneros {
  const fechaLiquidacion = resolveFechaLiquidacion(data);
  const ultima = ultimaPresentacionValidada(data.historialPresentaciones);
  const fechaUltimaPresentacion = parseIsoDate(ultima?.fechaPresentacion);

  const baseAnual = fechaUltimaPresentacion ?? fechaLiquidacion;
  const proximaCalculada = addYearsIso(baseAnual, 1);
  const proximaFechaPresentacion =
    parseIsoDate(data.fechaPresentacionSeniat) ?? proximaCalculada;

  const diasRestantesPresentacion = fechaLiquidacion
    ? diasHasta(proximaFechaPresentacion)
    : null;

  const fechaElegibilidadNacionalizacion =
    parseIsoDate(data.fechaLimiteNacionalizacion) ??
    addYearsIso(fechaLiquidacion, 3);
  const diasRestantesNacionalizacion = diasHasta(
    fechaElegibilidadNacionalizacion
  );

  const yaNacionalizado =
    data.estadoNacionalizacion === "nacionalizado" ||
    data.estadoNacionalizacion === "no_aplica";

  let progresoPermanenciaPct: number | null = null;
  if (fechaLiquidacion && fechaElegibilidadNacionalizacion) {
    const total = daysBetween(fechaLiquidacion, fechaElegibilidadNacionalizacion);
    const transcurridos = daysBetween(fechaLiquidacion, todayIso());
    if (total > 0) {
      progresoPermanenciaPct = Math.min(
        100,
        Math.max(0, Math.round((transcurridos / total) * 100))
      );
    }
  }

  return {
    fechaLiquidacion,
    fechaUltimaPresentacion,
    proximaFechaPresentacion: fechaLiquidacion
      ? proximaFechaPresentacion
      : null,
    diasRestantesPresentacion,
    estadoPresentacion: estadoPresentacionDesdeDias(diasRestantesPresentacion),
    fechaElegibilidadNacionalizacion,
    diasRestantesNacionalizacion,
    elegibleNacionalizacion:
      !yaNacionalizado &&
      diasRestantesNacionalizacion != null &&
      diasRestantesNacionalizacion <= 0,
    progresoPermanenciaPct: yaNacionalizado ? 100 : progresoPermanenciaPct,
  };
}

export function esAtencionPresentacion(data: ImportacionData): boolean {
  const plazos = computePlazosAduaneros(data);
  return (
    plazos.estadoPresentacion === "vencido" ||
    plazos.estadoPresentacion === "atencion"
  );
}

/** Dashboard: estado SENIAT pendiente/agendada o plazo ≤ 30 días / vencido. */
export function debeListarPresentacionSeniat(data: ImportacionData): boolean {
  if (esProximoSeniat(data)) return true;
  return esAtencionPresentacion(data);
}

export function plazosToListFields(data: ImportacionData): {
  fechaIngreso: string | null;
  fechaLiquidacion: string | null;
  fechaLimiteNacionalizacion: string | null;
  fechaPresentacionSeniat: string | null;
  diasNacionalizacion: number | null;
  diasSeniat: number | null;
  proximoNacionalizar: boolean;
  proximoSeniat: boolean;
  estadoPresentacion: EstadoPresentacionAnual | null;
  elegibleNacionalizacion: boolean;
  progresoPermanenciaPct: number | null;
} {
  const plazos = computePlazosAduaneros(data);
  return {
    fechaIngreso: parseIsoDate(data.fechaIngreso),
    fechaLiquidacion: plazos.fechaLiquidacion,
    fechaLimiteNacionalizacion: plazos.fechaElegibilidadNacionalizacion,
    fechaPresentacionSeniat: plazos.proximaFechaPresentacion,
    diasNacionalizacion: plazos.diasRestantesNacionalizacion,
    diasSeniat: plazos.diasRestantesPresentacion,
    proximoNacionalizar: esProximoNacionalizar(data),
    proximoSeniat: debeListarPresentacionSeniat(data),
    estadoPresentacion: plazos.estadoPresentacion,
    elegibleNacionalizacion: plazos.elegibleNacionalizacion,
    progresoPermanenciaPct: plazos.progresoPermanenciaPct,
  };
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  if (!a || !b) return 0;
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const start = Date.UTC(ay, am - 1, ad);
  const end = Date.UTC(by, bm - 1, bd);
  return Math.round((end - start) / 86_400_000);
}
