import { z } from "zod";
import {
  DESGASTE_CADENA_OPCIONES,
  ESTADO_MANGUERAS_OPCIONES,
  TIPOS_INDUSTRIA,
} from "@/lib/platform/types";

const desgasteValues = DESGASTE_CADENA_OPCIONES.map((o) => o.value) as [string, ...string[]];
const manguerasValues = ESTADO_MANGUERAS_OPCIONES.map((o) => o.value) as [string, ...string[]];

const baseRevision = z.object({
  vehiculoId: z.string().uuid("Selecciona un vehículo"),
  descripcion: z.string().trim().min(3, "Describe la revisión").max(500),
});

export const revisionConcesionarioSchema = baseRevision.extend({
  tipoIndustria: z.literal("concesionario"),
  voltajeBateria: z.coerce.number().min(0, "Mínimo 0 V").max(20, "Máximo 20 V"),
  kilometraje: z.coerce.number().int().min(0, "Kilometraje inválido"),
});

export const revisionBicicletasSchema = baseRevision.extend({
  tipoIndustria: z.literal("bicicletas"),
  desgasteCadena: z.enum(desgasteValues as ["lt_0.5", "0.5_0.75", "gt_0.75"]),
  presionSuspensionPsi: z.coerce.number().min(0).max(400),
});

export const revisionConstructoraSchema = baseRevision.extend({
  tipoIndustria: z.literal("constructora"),
  horometroActual: z.coerce.number().int().min(0, "Horómetro inválido"),
  estadoManguerasHidraulicas: z.enum(manguerasValues as ["ok", "desgaste", "fuga"]),
});

export const revisionSchema = z.discriminatedUnion("tipoIndustria", [
  revisionConcesionarioSchema,
  revisionBicicletasSchema,
  revisionConstructoraSchema,
]);

export type RevisionInput = z.input<typeof revisionSchema>;
export type RevisionParsed = z.infer<typeof revisionSchema>;

export function parseRevisionInput(
  tipoIndustria: (typeof TIPOS_INDUSTRIA)[number],
  raw: Record<string, unknown>
): { success: true; data: RevisionParsed } | { success: false; error: string } {
  const withIndustry = { ...raw, tipoIndustria };
  const parsed = revisionSchema.safeParse(withIndustry);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }
  return { success: true, data: parsed.data };
}
