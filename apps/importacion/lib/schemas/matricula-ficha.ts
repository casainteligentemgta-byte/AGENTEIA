import { z } from "zod";

export const MATRICULA_FICHA_SELECT =
  "id, created_at, updated_at, taller_id, placa, oficina_intt, fecha_tramite, requiere_homologacion, observaciones, activo";

export type MatriculaFichaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  taller_id: string;
  placa: string | null;
  oficina_intt: string | null;
  fecha_tramite: string | null;
  requiere_homologacion: boolean;
  observaciones: string | null;
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

export const asignarMatriculaSchema = z.object({
  fichaId: z.string().uuid(),
  vehiculoId: z.string().uuid(),
});

export const matriculaFichaUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  placa: optionalText(20),
  oficinaIntt: optionalText(120),
  fechaTramite: optionalText(32),
  requiereHomologacion: z.preprocess((v) => {
    if (v === true || v === "true" || v === "on" || v === "1") return true;
    return false;
  }, z.boolean()),
  observaciones: optionalText(1000),
});
