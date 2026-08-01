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
  /** Placa real del vehículo (opcional; distinta del número de expediente). */
  placa: z.string().trim().max(20).optional().or(z.literal("")),
  /** Fecha de llegada del buque al puerto (YYYY-MM-DD). */
  fechaLlegadaBuque: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresa la fecha de llegada del buque"),

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

  /** Datos aduaneros opcionales; se pueden completar después en Editar. */
  aduana: z.string().trim().max(120).optional().or(z.literal("")),
  numeroBl: z.string().trim().max(80).optional().or(z.literal("")),
  paisOrigen: z.string().trim().max(80).optional().or(z.literal("")),
  valorCif: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).trim());
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  observaciones: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type PuertoLibreAltaInput = z.infer<typeof puertoLibreAltaSchema>;

/** Genera el siguiente número de expediente PL-Año.Mes.N para el taller. */
export function placaTemporalDesdeSerial(serialCarroceria: string): string {
  const clean = serialCarroceria.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffix = (clean.slice(-10) || Date.now().toString(36).toUpperCase()).slice(0, 10);
  return `PL-${suffix}`.slice(0, 20);
}
