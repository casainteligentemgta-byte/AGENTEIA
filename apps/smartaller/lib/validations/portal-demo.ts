import { z } from "zod";
import {
  DEMO_DURACION_HORAS,
  DEMO_ROLES_PERMITIDOS,
} from "@/lib/portal/demo-access";

export const crearAccesoDemoSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(254),
  duracionHoras: z.coerce
    .number()
    .refine(
      (n): n is (typeof DEMO_DURACION_HORAS)[number] =>
        (DEMO_DURACION_HORAS as readonly number[]).includes(n),
      "Duración no permitida"
    ),
  roles: z
    .array(z.enum(DEMO_ROLES_PERMITIDOS))
    .min(1, "Elige al menos un rol")
    .max(4),
  orgNombre: z
    .string()
    .trim()
    .max(80, "Máximo 80 caracteres")
    .nullable()
    .optional(),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(72)
    .optional()
    .nullable(),
});

export const cerrarAccesoDemoSchema = z.object({
  userId: z.string().uuid("Usuario inválido"),
});

export type CrearAccesoDemoInput = z.infer<typeof crearAccesoDemoSchema>;
