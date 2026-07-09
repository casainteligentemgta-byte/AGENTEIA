import { z } from "zod";

export const vehiculoDocumentoRefSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  scanned_at: z.string().optional(),
});

export const vehiculosDocumentosSchema = z.object({
  cedula: vehiculoDocumentoRefSchema.optional(),
  titulo: vehiculoDocumentoRefSchema.optional(),
});

export type VehiculoDocumentoRef = z.infer<typeof vehiculoDocumentoRefSchema>;
export type VehiculosDocumentos = z.infer<typeof vehiculosDocumentosSchema>;

export function parseVehiculosDocumentos(raw: unknown): VehiculosDocumentos {
  const parsed = vehiculosDocumentosSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
