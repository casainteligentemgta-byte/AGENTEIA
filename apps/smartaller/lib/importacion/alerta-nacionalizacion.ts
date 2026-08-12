import { fechaLimitePermanencia3Anios } from "@/lib/importacion/nacionalizacion";
import { getRegimenConfig } from "@/lib/importacion/regimenes";
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

function formatFechaLimite(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function textoAlerta(dias: number, fechaLimite: string): Pick<
  AlertaNacionalizacion,
  "titulo" | "detalle"
> {
  const fecha = formatFechaLimite(fechaLimite);
  if (dias < 0) {
    const n = Math.abs(dias);
    return {
      titulo:
        n === 1
          ? "Plazo de nacionalización vencido hace 1 día"
          : `Plazo de nacionalización vencido hace ${n} días`,
      detalle: `El límite (ingreso + 3 años) era el ${fecha}. Gestiona la vía con el agente aduanal / SENIAT.`,
    };
  }
  if (dias === 0) {
    return {
      titulo: "Hoy vence el plazo de nacionalización",
      detalle: `Límite ${fecha} (3 años en Puerto Libre). Continúa el trámite hoy.`,
    };
  }
  if (dias === 1) {
    return {
      titulo: "Queda 1 día para nacionalizar",
      detalle: `Límite ${fecha}. Prepara documentos y vía de nacionalización.`,
    };
  }
  return {
    titulo: `Quedan ${dias} días para nacionalizar`,
    detalle: `Límite ${fecha} (3 años desde el ingreso a Puerto Libre).`,
  };
}

/**
 * Alerta de días restantes hasta el umbral de nacionalización (permanencia 3 años).
 * Null si no aplica (régimen sin PL, ya nacionalizado, o sin fecha de ingreso/límite).
 */
export function buildAlertaNacionalizacion(
  importacion: ImportacionData
): AlertaNacionalizacion | null {
  if (!getRegimenConfig(importacion.regimen).nacionalizacionPuertoLibre) {
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
  const { titulo, detalle } = textoAlerta(dias, fechaLimite);
  return { fechaLimite, dias, urgencia, titulo, detalle };
}
