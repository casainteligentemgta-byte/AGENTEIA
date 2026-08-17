import { z } from "zod";
import { TIPOS_VEHICULO } from "@/lib/vehicles/types";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";

export const createVehicleSchema = z
  .object({
    tipo_vehiculo: z.enum(TIPOS_VEHICULO),
    nick: z.string().trim().max(60).optional().or(z.literal("")),
    marca: z.string().trim().max(80).optional().or(z.literal("")),
    modelo: z.string().trim().max(80).optional().or(z.literal("")),
    color: z.string().trim().max(40).optional().or(z.literal("")),
    placa: z
      .string()
      .trim()
      .min(2, "La placa o identificador es obligatorio")
      .max(20, "Máximo 20 caracteres")
      .transform((v) => v.toUpperCase()),
    codigo_vinculo: z
      .string()
      .trim()
      .max(12)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v?.trim() ? v.trim().toUpperCase() : undefined)),
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

export type CreateVehicleInput = z.input<typeof createVehicleSchema>;
export type CreateVehicleParsed = z.infer<typeof createVehicleSchema>;
