import { z } from "zod";

const currentYear = new Date().getFullYear();

export const puertoLibreAltaSchema = z.object({
  marca: z.string().trim().min(1, "Ingresa la marca").max(80),
  modelo: z.string().trim().min(1, "Ingresa el modelo").max(80),
  serialCarroceria: z.string().trim().min(1, "Ingresa el serial de carrocería").max(80),
  serialMotor: z.string().trim().min(1, "Ingresa el serial del motor").max(80),
  color: z.string().trim().min(1, "Ingresa el color").max(40),
  anio: z.coerce
    .number({ invalid_type_error: "Ingresa el año" })
    .int()
    .min(1950, "Año inválido")
    .max(currentYear + 1, "Año inválido"),
  fechaIngresoPl: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de ingreso a PL inválida"),
  placa: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.toUpperCase() : "")),

  importadorNombre: z.string().trim().min(1, "Ingresa el nombre del importador").max(120),
  importadorDocumento: z.string().trim().max(40).optional().or(z.literal("")),
  importadorTelefono: z.string().trim().max(40).optional().or(z.literal("")),
  importadorEmail: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo del importador inválido",
    }),

  compradorNombre: z.string().trim().min(1, "Ingresa el nombre del comprador").max(120),
  compradorCedula: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.replace(/\D/g, "") : "")),
  compradorTelefono: z
    .string()
    .trim()
    .min(7, "Ingresa un teléfono del comprador")
    .max(20),
  compradorEmail: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo del comprador inválido",
    }),
});

export type PuertoLibreAltaInput = z.infer<typeof puertoLibreAltaSchema>;
