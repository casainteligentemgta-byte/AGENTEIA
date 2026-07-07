import { z } from "zod";

export const createRepuestoSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre obligatorio").max(120),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  unidad: z.string().trim().max(20).optional().or(z.literal("")),
  precioVenta: z.coerce.number().nonnegative(),
  stockActual: z.coerce.number().nonnegative().optional(),
  stockMinimo: z.coerce.number().nonnegative().optional(),
});

export type CreateRepuestoInput = z.infer<typeof createRepuestoSchema>;

export const repuestoLineaSchema = z.object({
  repuestoId: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "Nombre del repuesto obligatorio").max(120),
  cantidad: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
  precioUnitario: z.coerce.number().nonnegative(),
});

export const repuestosLineasSchema = z
  .array(repuestoLineaSchema)
  .max(30, "Máximo 30 líneas por orden");

export type RepuestoLineaParsed = z.infer<typeof repuestoLineaSchema>;

export function parseRepuestosLineasJson(raw: string | null | undefined): RepuestoLineaParsed[] {
  if (!raw?.trim()) return [];
  try {
    const data = JSON.parse(raw);
    const parsed = repuestosLineasSchema.safeParse(data);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
