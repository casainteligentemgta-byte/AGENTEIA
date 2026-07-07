import { z } from "zod";
import { DiagnosticoMediaListSchema } from "@/lib/schemas/diagnostico-media";

export const EstadoCategoria = z.enum(["bien", "atencion", "critico"]);
export type EstadoCategoriaValue = z.infer<typeof EstadoCategoria>;

export const CategoriaVehiculoSchema = z.object({
  estado: EstadoCategoria,
  fecha_revision: z.string().date().nullable().optional(),
  notas: z.string().optional(),
});

export type CategoriaVehiculo = z.infer<typeof CategoriaVehiculoSchema>;

export const CategoriasSchema = z
  .object({
    bateria: CategoriaVehiculoSchema.optional(),
    neumaticos: CategoriaVehiculoSchema.optional(),
    aceite: CategoriaVehiculoSchema.optional(),
    general: CategoriaVehiculoSchema.optional(),
  })
  .partial();

export type Categorias = z.infer<typeof CategoriasSchema>;

export const CATEGORIAS_VEHICULO = ["bateria", "neumaticos", "aceite", "general"] as const;
export type CategoriaVehiculoId = (typeof CATEGORIAS_VEHICULO)[number];

/** Lectura tolerante: passthrough conserva claves B2B sin tocarlas. */
export const DetalleRevisionSchema = z
  .object({
    categorias: CategoriasSchema.optional(),
    media: DiagnosticoMediaListSchema.optional(),
  })
  .passthrough();

export type DetalleRevision = z.infer<typeof DetalleRevisionSchema>;

export function parseDetalleRevision(raw: unknown): DetalleRevision {
  const parsed = DetalleRevisionSchema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as DetalleRevision;
  }
  return {};
}
