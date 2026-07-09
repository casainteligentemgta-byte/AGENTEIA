import { z } from "zod";
import { TIPOS_VEHICULO } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";

import { recepcionVehiculoSchema } from "@/lib/schemas/recepcion-vehiculo";

export const updateVehiculoContactoSchema = z.object({
  vehiculoId: z.string().uuid("ID de vehículo inválido"),
  nombreCliente: z
    .string()
    .max(120)
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Ingresa el nombre del cliente")),
  telefonoCliente: z
    .string()
    .max(20)
    .transform((v) => v.trim())
    .pipe(z.string().min(7, "Ingresa un teléfono válido")),
});

export const recordatorioEstadoSchema = z.object({
  recordatorioId: z.string().uuid("ID de recordatorio inválido"),
  estado: z.enum(["completado", "cancelado", "pendiente"]),
});

export const createVehiculoTallerSchema = z
  .object({
    tipo_vehiculo: z.enum(TIPOS_VEHICULO),
    placa: z
      .string()
      .trim()
      .min(2, "La placa o identificador es obligatorio")
      .max(20, "Máximo 20 caracteres")
      .transform((v) => v.toUpperCase()),
    marca: z.string().trim().max(80).optional().or(z.literal("")),
    modelo: z.string().trim().max(80).optional().or(z.literal("")),
    color: z.string().trim().max(40).optional().or(z.literal("")),
    nombreCliente: z
      .string()
      .trim()
      .min(1, "Ingresa el nombre del comprador")
      .max(120),
    telefonoCliente: z
      .string()
      .trim()
      .min(7, "Ingresa un teléfono válido")
      .max(20),
    serialMotor: z.string().trim().max(80).optional().or(z.literal("")),
    serialCarroceria: z.string().trim().max(80).optional().or(z.literal("")),
    cedulaPropietario: z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal(""))
      .transform((v) => {
        if (!v) return "";
        return v.replace(/\D/g, "");
      }),
    emailPropietario: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: "Ingresa un correo válido",
      }),
    fechaNacimientoPropietario: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
        message: "Fecha de nacimiento inválida",
      }),
    documentos: z
      .object({
        cedula: z.object({ url: z.string(), path: z.string(), scanned_at: z.string().optional() }).optional(),
        titulo: z.object({ url: z.string(), path: z.string(), scanned_at: z.string().optional() }).optional(),
      })
      .optional(),
    recepcionInicial: recepcionVehiculoSchema.optional(),
    odometro: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((v) => {
        if (!v || v.trim() === "") return null;
        const n = Number(v.replace(/\./g, "").replace(",", "."));
        return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
      }),
  })
  .superRefine((data, ctx) => {
    const config = getConfigTipoVehiculo(data.tipo_vehiculo);
    if (config.unidadOdometro === "horas" && data.odometro != null && data.odometro > 100000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Revisa las horas de motor ingresadas",
        path: ["odometro"],
      });
    }
  });

export type CreateVehiculoTallerInput = z.input<typeof createVehiculoTallerSchema>;
