import { fechaLimitePermanencia3Anios } from "@/lib/importacion/nacionalizacion";
import {
  resolveRegimenImportacion,
  type RegimenImportacion,
} from "@/lib/importacion/regimenes";
import {
  diasHasta,
  type ImportacionData,
} from "@/lib/schemas/vehiculo-documentos";

/** Umbrales de urgencia visual (días hasta el límite de 3 años en PL). */
export const ALERTA_NACIONALIZACION_URGENTE_DIAS = 30;
export const ALERTA_NACIONALIZACION_AVISO_DIAS = 90;

export type UrgenciaNacionalizacion =
  | "ok"
  | "aviso"
  | "urgente"
  | "hoy"
  | "vencido";

export type AlertaNacionalizacion = {
  fechaLimite: string;
  dias: number;
  urgencia: UrgenciaNacionalizacion;
  titulo: string;
  detalle: string;
  /** Régimen que alimenta este reloj. */
  regimen: Extract<RegimenImportacion, "puerto_libre" | "equipaje">;
};

/** Fecha límite efectiva: guardada o ingreso + 3 años. */
export function resolverFechaLimiteNacionalizacion(
  importacion: ImportacionData
): string | null {
  const guardada = importacion.fechaLimiteNacionalizacion?.trim();
  if (guardada && /^\d{4}-\d{2}-\d{2}/.test(guardada)) {
    return guardada.slice(0, 10);
  }
  return fechaLimitePermanencia3Anios(importacion.fechaIngreso);
}

export function urgenciaPorDias(dias: number): UrgenciaNacionalizacion {
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= ALERTA_NACIONALIZACION_URGENTE_DIAS) return "urgente";
  if (dias <= ALERTA_NACIONALIZACION_AVISO_DIAS) return "aviso";
  return "ok";
}

export function formatFechaPlazo(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function textoAlerta(
  dias: number,
  fechaLimite: string,
  regimen: Extract<RegimenImportacion, "puerto_libre" | "equipaje">
): Pick<AlertaNacionalizacion, "titulo" | "detalle"> {
  const fecha = formatFechaPlazo(fechaLimite);
  const esEquipaje = regimen === "equipaje";
  const via = esEquipaje
    ? "régimen de equipaje"
    : "Puerto Libre";
  if (dias < 0) {
    const n = Math.abs(dias);
    return {
      titulo:
        n === 1
          ? `Nacionalización (${via}) vencida hace 1 día`
          : `Nacionalización (${via}) vencida hace ${n} días`,
      detalle: esEquipaje
        ? `El límite era el ${fecha}. Presenta el expediente ante el SENIAT.`
        : `El límite (ingreso + 3 años) era el ${fecha}. Gestiona la vía con el agente aduanal / SENIAT.`,
    };
  }
  if (dias === 0) {
    return {
      titulo: esEquipaje
        ? "Hoy vence la nacionalización por equipaje"
        : "Hoy vence el plazo de nacionalización",
      detalle: `Límite ${fecha}. Continúa el trámite hoy.`,
    };
  }
  if (dias === 1) {
    return {
      titulo: esEquipaje
        ? "Queda 1 día para nacionalizar por equipaje"
        : "Queda 1 día para nacionalizar",
      detalle: `Límite ${fecha}.`,
    };
  }
  return {
    titulo: esEquipaje
      ? `Quedan ${dias} días para nacionalizar por equipaje`
      : `Quedan ${dias} días para nacionalizar`,
    detalle: esEquipaje
      ? `Límite ${fecha} (régimen de equipaje · cupo 1 vehículo / 3 años).`
      : `Límite ${fecha} (3 años desde el ingreso a Puerto Libre).`,
  };
}

/** Puerto Libre (permanencia 3 años) y régimen de equipaje. */
export function regimenTieneRelojNacionalizacion(
  regimen: string | null | undefined
): boolean {
  const codigo = resolveRegimenImportacion(regimen);
  return codigo === "puerto_libre" || codigo === "equipaje";
}

/**
 * Alerta de días restantes hasta el umbral de nacionalización.
 * Null si no aplica (otro régimen, ya nacionalizado, o sin fecha).
 */
export function buildAlertaNacionalizacion(
  importacion: ImportacionData
): AlertaNacionalizacion | null {
  const regimen = resolveRegimenImportacion(importacion.regimen);
  if (regimen !== "puerto_libre" && regimen !== "equipaje") {
    return null;
  }
  const estado = importacion.estadoNacionalizacion ?? "pendiente";
  if (estado === "nacionalizado" || estado === "no_aplica") {
    return null;
  }

  const fechaLimite = resolverFechaLimiteNacionalizacion(importacion);
  if (!fechaLimite) return null;

  const dias = diasHasta(fechaLimite);
  if (dias == null) return null;

  const urgencia = urgenciaPorDias(dias);
  const { titulo, detalle } = textoAlerta(dias, fechaLimite, regimen);
  return { fechaLimite, dias, urgencia, titulo, detalle, regimen };
}
