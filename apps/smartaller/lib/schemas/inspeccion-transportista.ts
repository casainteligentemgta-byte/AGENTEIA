import { z } from "zod";
import {
  estadoVisualRecepcionSchema,
  parseEstadoVisualRecepcion,
  type EstadoVisualRecepcion,
} from "@/lib/schemas/estado-visual-recepcion";

/** Sin botón "OK": solo marcar daño o N/A. `sin_dano` = ítem verificado OK sin usarlo como etiqueta. */
export const checklistRespuestaSchema = z.enum(["sin_dano", "falla", "na"]);

export const inspeccionTransportistaSchema = z.object({
  vehiculoId: z.string().uuid(),
  transportista: z.string().trim().max(120).optional().nullable(),
  numeroGuia: z.string().trim().max(80).optional().nullable(),
  fechaRecepcion: z.string().trim().max(32).optional().nullable(),
  lugarRecepcion: z.string().trim().max(120).optional().nullable(),
  contenedor: z.string().trim().max(80).optional().nullable(),
  placaTexto: z.string().trim().max(32).optional().nullable(),
  vin: z.string().trim().max(40).optional().nullable(),
  kilometraje: z.coerce.number().int().min(0).optional().nullable(),
  blDocumentoUrl: z.string().trim().max(500).optional().nullable(),
  fotoPlacaUrl: z.string().trim().max(500).optional().nullable(),
  checklist: z.record(z.string(), checklistRespuestaSchema),
  estadoVisual: estadoVisualRecepcionSchema.optional(),
  danosReportados: z.string().trim().max(2000).optional().nullable(),
  observaciones: z.string().trim().max(2000).optional().nullable(),
  receptorNombre: z.string().trim().max(120).optional().nullable(),
  transportistaNombre: z.string().trim().max(120).optional().nullable(),
});

export type InspeccionTransportistaInput = z.infer<typeof inspeccionTransportistaSchema>;
export type ChecklistRespuesta = z.infer<typeof checklistRespuestaSchema>;

export type InspeccionTransportistaStored = InspeccionTransportistaInput & {
  updated_at: string;
  version: 1 | 2;
};

function normalizeChecklistValue(raw: unknown): ChecklistRespuesta {
  if (raw === "ok" || raw === "sin_dano") return "sin_dano";
  if (raw === "falla") return "falla";
  return "na";
}

export function parseInspeccionTransportista(raw: unknown): InspeccionTransportistaStored | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const checklistRaw =
    row.checklist && typeof row.checklist === "object"
      ? (row.checklist as Record<string, unknown>)
      : {};
  const checklist: Record<string, ChecklistRespuesta> = {};
  for (const [key, value] of Object.entries(checklistRaw)) {
    checklist[key] = normalizeChecklistValue(value);
  }

  const blUrl = row.blDocumentoUrl ?? row.bl_documento_url;
  const fotoPlaca = row.fotoPlacaUrl ?? row.foto_placa_url;

  const parsed = inspeccionTransportistaSchema.safeParse({
    vehiculoId: row.vehiculoId ?? row.vehiculo_id,
    transportista: row.transportista,
    numeroGuia: row.numeroGuia ?? row.numero_guia,
    fechaRecepcion: row.fechaRecepcion ?? row.fecha_recepcion,
    lugarRecepcion: row.lugarRecepcion ?? row.lugar_recepcion,
    contenedor: row.contenedor,
    placaTexto: row.placaTexto ?? row.placa_texto,
    vin: row.vin,
    kilometraje: row.kilometraje,
    blDocumentoUrl: typeof blUrl === "string" && blUrl.trim() ? blUrl : null,
    fotoPlacaUrl: typeof fotoPlaca === "string" && fotoPlaca.trim() ? fotoPlaca : null,
    checklist,
    estadoVisual: row.estadoVisual ?? row.estado_visual,
    danosReportados: row.danosReportados ?? row.danos_reportados,
    observaciones: row.observaciones,
    receptorNombre: row.receptorNombre ?? row.receptor_nombre,
    transportistaNombre: row.transportistaNombre ?? row.transportista_nombre,
  });
  if (!parsed.success) return null;

  const estadoVisual: EstadoVisualRecepcion | undefined = parsed.data.estadoVisual
    ? parseEstadoVisualRecepcion(parsed.data.estadoVisual) ?? parsed.data.estadoVisual
    : undefined;

  return {
    ...parsed.data,
    estadoVisual,
    version: 2,
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}
