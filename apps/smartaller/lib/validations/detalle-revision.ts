import { z } from "zod";

export const ESTADOS_SALUD = ["bien", "atencion", "critico"] as const;
export type EstadoSalud = (typeof ESTADOS_SALUD)[number];

export const CATEGORIAS_SALUD = ["bateria", "neumaticos", "aceite", "general"] as const;
export type CategoriaSaludId = (typeof CATEGORIAS_SALUD)[number];

const categoriaSaludSchema = z.object({
  estado: z.enum(ESTADOS_SALUD),
  fecha_revision: z.string().optional(),
  notas: z.string().optional(),
});

export const categoriasSaludSchema = z.object({
  bateria: categoriaSaludSchema.optional(),
  neumaticos: categoriaSaludSchema.optional(),
  aceite: categoriaSaludSchema.optional(),
  general: categoriaSaludSchema.optional(),
});

/** Namespace universal B2C; convive con claves B2B planas en la raíz del jsonb. */
export const detalleRevisionSchema = z
  .object({
    categorias: categoriasSaludSchema.optional(),
    voltaje_bateria: z.number().optional(),
    kilometraje: z.number().optional(),
    desgaste_cadena: z.string().optional(),
    presion_suspension_psi: z.number().optional(),
    horometro_actual: z.number().optional(),
    estado_mangueras_hidraulicas: z.string().optional(),
  })
  .passthrough();

export type DetalleRevision = z.infer<typeof detalleRevisionSchema>;
export type CategoriaSaludDetalle = z.infer<typeof categoriaSaludSchema>;

export function parseDetalleRevision(raw: unknown): DetalleRevision {
  const parsed = detalleRevisionSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
