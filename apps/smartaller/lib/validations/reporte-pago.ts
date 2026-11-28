import { z } from "zod";
import { MONEDAS_PAGO, TIPOS_PLAN_PAGO } from "@/lib/billing/plans";

const REFERENCIA_RE = /^[A-Za-z0-9-]{4,24}$/;

export const reportePagoSchema = z.object({
  tipoPlan: z.enum(TIPOS_PLAN_PAGO),
  monto: z.coerce
    .number({ invalid_type_error: "Indica el monto pagado" })
    .positive("El monto debe ser mayor a 0")
    .max(1_000_000, "Monto fuera de rango"),
  moneda: z.enum(MONEDAS_PAGO),
  referencia: z
    .string()
    .trim()
    .min(4, "La referencia debe tener al menos 4 caracteres")
    .max(24, "La referencia es demasiado larga")
    .regex(REFERENCIA_RE, "Usa solo letras, números o guiones"),
  fechaPago: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00-04:00`);
      if (Number.isNaN(parsed.getTime())) return false;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return parsed.getTime() <= tomorrow.getTime();
    }, "La fecha de pago no puede ser futura"),
});

export type ReportePagoInput = z.infer<typeof reportePagoSchema>;

export const cancelarReporteSchema = z.object({
  reporteId: z.string().uuid(),
});

export const revisarReporteSchema = z.object({
  reporteId: z.string().uuid(),
  notas: z.string().trim().max(1000).optional(),
});

export const rechazarReporteSchema = z.object({
  reporteId: z.string().uuid(),
  notas: z
    .string()
    .trim()
    .min(4, "Indica el motivo del rechazo")
    .max(1000, "El motivo es demasiado largo"),
});
