import { z } from "zod";

export const checklistRespuestaSchema = z.enum(["ok", "falla", "na"]);

export const inspeccionTransportistaSchema = z.object({
  vehiculoId: z.string().uuid(),
  transportista: z.string().trim().max(120).optional().nullable(),
  numeroGuia: z.string().trim().max(80).optional().nullable(),
  fechaRecepcion: z.string().trim().max(32).optional().nullable(),
  lugarRecepcion: z.string().trim().max(120).optional().nullable(),
  contenedor: z.string().trim().max(80).optional().nullable(),
  kilometraje: z.coerce.number().int().min(0).optional().nullable(),
  checklist: z.record(z.string(), checklistRespuestaSchema),
  danosReportados: z.string().trim().max(2000).optional().nullable(),
  observaciones: z.string().trim().max(2000).optional().nullable(),
  receptorNombre: z.string().trim().max(120).optional().nullable(),
  transportistaNombre: z.string().trim().max(120).optional().nullable(),
});

export type InspeccionTransportistaInput = z.infer<typeof inspeccionTransportistaSchema>;
export type ChecklistRespuesta = z.infer<typeof checklistRespuestaSchema>;

export type InspeccionTransportistaStored = InspeccionTransportistaInput & {
  updated_at: string;
  version: 1;
};

export function parseInspeccionTransportista(raw: unknown): InspeccionTransportistaStored | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const parsed = inspeccionTransportistaSchema.safeParse({
    vehiculoId: row.vehiculoId ?? row.vehiculo_id,
    transportista: row.transportista,
    numeroGuia: row.numeroGuia ?? row.numero_guia,
    fechaRecepcion: row.fechaRecepcion ?? row.fecha_recepcion,
    lugarRecepcion: row.lugarRecepcion ?? row.lugar_recepcion,
    contenedor: row.contenedor,
    kilometraje: row.kilometraje,
    checklist: row.checklist ?? {},
    danosReportados: row.danosReportados ?? row.danos_reportados,
    observaciones: row.observaciones,
    receptorNombre: row.receptorNombre ?? row.receptor_nombre,
    transportistaNombre: row.transportistaNombre ?? row.transportista_nombre,
  });
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    version: 1,
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}
