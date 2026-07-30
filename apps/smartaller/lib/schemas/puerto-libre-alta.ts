import { z } from "zod";

const currentYear = new Date().getFullYear();

/** Fase 1: datos del vehículo + importador. */
export const puertoLibreAltaSchema = z.object({
  marca: z.string().trim().min(1, "Ingresa la marca").max(80),
  modelo: z.string().trim().min(1, "Ingresa el modelo").max(80),
  color: z.string().trim().min(1, "Ingresa el color").max(40),
  anio: z.coerce
    .number({ invalid_type_error: "Ingresa el año" })
    .int()
    .min(1950, "Año inválido")
    .max(currentYear + 1, "Año inválido"),
  serialMotor: z.string().trim().min(1, "Ingresa el serial del motor").max(80),
  serialCarroceria: z.string().trim().min(1, "Ingresa el serial de carrocería").max(80),

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
});

export type PuertoLibreAltaInput = z.infer<typeof puertoLibreAltaSchema>;

/** Genera identificador temporal único hasta asignar placa real. */
export function placaTemporalDesdeSerial(serialCarroceria: string): string {
  const clean = serialCarroceria.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffix = (clean.slice(-10) || Date.now().toString(36).toUpperCase()).slice(0, 10);
  return `PL-${suffix}`.slice(0, 20);
}
