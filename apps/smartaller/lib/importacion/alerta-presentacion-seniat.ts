import {
  formatFechaPlazo,
  type UrgenciaNacionalizacion,
} from "@/lib/importacion/alerta-nacionalizacion";
import {
  diasHasta,
  type ImportacionData,
} from "@/lib/schemas/vehiculo-documentos";

/** Cita SENIAT: aviso a 14 días, urgente a 7. */
export const ALERTA_SENIAT_URGENTE_DIAS = 7;
export const ALERTA_SENIAT_AVISO_DIAS = 14;

export type AlertaPresentacionSeniat = {
  fechaPresentacion: string;
  dias: number;
  urgencia: UrgenciaNacionalizacion;
  titulo: string;
  detalle: string;
};

export function urgenciaPresentacionSeniat(
  dias: number
): UrgenciaNacionalizacion {
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= ALERTA_SENIAT_URGENTE_DIAS) return "urgente";
  if (dias <= ALERTA_SENIAT_AVISO_DIAS) return "aviso";
  return "ok";
}

function textoAlerta(
  dias: number,
  fechaPresentacion: string
): Pick<AlertaPresentacionSeniat, "titulo" | "detalle"> {
  const fecha = formatFechaPlazo(fechaPresentacion);
  if (dias < 0) {
    const n = Math.abs(dias);
    return {
      titulo:
        n === 1
          ? "La presentación SENIAT venció ayer"
          : `La presentación SENIAT venció hace ${n} días`,
      detalle: `La cita era el ${fecha}. Reagenda o presenta el expediente.`,
    };
  }
  if (dias === 0) {
    return {
      titulo: "Hoy toca presentación en el SENIAT",
      detalle: `Cita ${fecha}. Lleva el expediente PDF y los recaudos.`,
    };
  }
  if (dias === 1) {
    return {
      titulo: "Mañana toca presentación en el SENIAT",
      detalle: `Cita ${fecha}.`,
    };
  }
  return {
    titulo: `Faltan ${dias} días para la presentación SENIAT`,
    detalle: `Cita ${fecha}.`,
  };
}

/**
 * Reloj de la cita de presentación ante el SENIAT.
 * Null si ya se presentó, fue rechazada, o no hay fecha.
 */
export function buildAlertaPresentacionSeniat(
  importacion: ImportacionData
): AlertaPresentacionSeniat | null {
  const estado = (importacion.estadoSeniat ?? "pendiente").trim().toLowerCase();
  if (estado === "presentada" || estado === "rechazada") return null;

  const raw = importacion.fechaPresentacionSeniat?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return null;
  const fechaPresentacion = raw.slice(0, 10);

  const dias = diasHasta(fechaPresentacion);
  if (dias == null) return null;

  const urgencia = urgenciaPresentacionSeniat(dias);
  const { titulo, detalle } = textoAlerta(dias, fechaPresentacion);
  return { fechaPresentacion, dias, urgencia, titulo, detalle };
}
