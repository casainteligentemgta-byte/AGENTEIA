import { z } from "zod";
import { normalizeCedula } from "@/lib/validations/cedula";

export const PROPIETARIO_SELECT =
  "id, created_at, updated_at, taller_id, nombre, cedula, telefono, email, fecha_nacimiento, direccion, activo";

export type PropietarioRow = {
  id: string;
  created_at: string;
  updated_at: string;
  taller_id: string;
  nombre: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  fecha_nacimiento: string | null;
  direccion: string | null;
  activo: boolean;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      const s = (v ?? "").trim();
      return s.length ? s : null;
    });

export const propietarioUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "Nombre del propietario requerido").max(120),
  cedula: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((v) => {
      const s = normalizeCedula(v ?? "");
      return s || null;
    }),
  telefono: optionalText(40),
  email: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s.length ? s : null;
  }, z.string().email("Email inválido").max(120).nullable()),
  fechaNacimiento: optionalText(32),
  direccion: optionalText(240),
});

export type PropietarioUpsertInput = z.infer<typeof propietarioUpsertSchema>;

export const asignarExpedienteSchema = z.object({
  propietarioId: z.string().uuid(),
  vehiculoId: z.string().uuid(),
});
