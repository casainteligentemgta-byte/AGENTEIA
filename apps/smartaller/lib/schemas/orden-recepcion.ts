import { z } from "zod";

/** Alineado con enums de 20250712100000_ordenes_recepcion.sql */

export const RECEPCION_CHECKLIST_SECCION = [
  "interior_electrico",
  "interior_accesorios",
  "bajo_capot",
  "parte_trasera_exterior",
] as const;

export const RECEPCION_CHECKLIST_VALOR = [
  "presente",
  "ausente",
  "bueno",
  "regular",
  "malo",
  "no_aplica",
] as const;

export const RECEPCION_TIPO_DANO = [
  "rayado",
  "falta_pieza",
  "abolladura",
  "roto",
] as const;

export const RECEPCION_VISTA_VEHICULO = [
  "superior",
  "lateral_izquierdo",
  "lateral_derecho",
  "frontal",
  "trasero",
] as const;

export const RECEPCION_TIPO_DANO_SIMBOLO: Record<
  (typeof RECEPCION_TIPO_DANO)[number],
  string
> = {
  rayado: "—",
  falta_pieza: "X",
  abolladura: "O",
  roto: "Δ",
};

export const RECEPCION_CHECKLIST_VALOR_LABELS: Record<
  (typeof RECEPCION_CHECKLIST_VALOR)[number],
  string
> = {
  presente: "Presente",
  ausente: "Ausente",
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
  no_aplica: "N/A",
};

export const RECEPCION_SECCION_LABELS: Record<
  (typeof RECEPCION_CHECKLIST_SECCION)[number],
  string
> = {
  interior_electrico: "A. Interior — Sistemas eléctricos",
  interior_accesorios: "A. Interior — Accesorios y acabados",
  bajo_capot: "B. Bajo el capot",
  parte_trasera_exterior: "C. Parte trasera / exterior",
};

const checklistRespuestaSchema = z.object({
  itemId: z.string().min(1),
  valor: z.enum(RECEPCION_CHECKLIST_VALOR).default("no_aplica"),
  notas: z.string().trim().max(500).optional().or(z.literal("")),
});

const danoVisualSchema = z.object({
  vista: z.enum(RECEPCION_VISTA_VEHICULO).default("superior"),
  zonaId: z.string().min(1),
  tipo: z.enum(RECEPCION_TIPO_DANO),
  posicionX: z.coerce.number().min(0).max(100),
  posicionY: z.coerce.number().min(0).max(100),
  notas: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Campos de la orden embebidos en el alta de vehículo (sin IDs de vehículo/cliente) */
export const ordenRecepcionAltaSchema = z.object({
  fechaIngreso: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional()
    .or(z.literal("")),
  horaIngreso: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida")
    .optional()
    .or(z.literal("")),
  kilometraje: z.coerce.number().int().min(0).nullable().optional(),
  llegoGrua: z.boolean().default(false),
  vehiculoSucio: z.boolean().default(false),
  estadoIngresoNotas: z.string().trim().max(500).optional().or(z.literal("")),
  motivoVisita: z.string().trim().max(500).optional().or(z.literal("")),
  checklist: z.array(checklistRespuestaSchema).default([]),
  danos: z.array(danoVisualSchema).default([]),
  firmaCliente: z.string().trim().max(120).optional().or(z.literal("")),
  firmaAsesor: z.string().trim().max(120).optional().or(z.literal("")),
});

/** Payload para crear una orden de recepción completa */
export const crearOrdenRecepcionSchema = ordenRecepcionAltaSchema.extend({
  vehiculoId: z.string().uuid(),
  mantenimientoId: z.string().uuid().optional(),
  clienteNombre: z.string().trim().min(1).max(120),
  clienteTelefono: z.string().trim().min(7).max(20),
  placa: z.string().trim().min(2).max(20),
  modelo: z.string().trim().max(80).optional().or(z.literal("")),
  color: z.string().trim().max(40).optional().or(z.literal("")),
  chasis: z.string().trim().max(80).optional().or(z.literal("")),
});

export type OrdenRecepcionAltaInput = z.infer<typeof ordenRecepcionAltaSchema>;
export type CrearOrdenRecepcionInput = z.infer<typeof crearOrdenRecepcionSchema>;
export type OrdenRecepcionChecklistRespuesta = z.infer<typeof checklistRespuestaSchema>;
export type OrdenRecepcionDanoVisual = z.infer<typeof danoVisualSchema>;

export type OrdenRecepcionFormValue = Partial<OrdenRecepcionAltaInput>;

export function tieneDatosOrdenRecepcion(raw: unknown): boolean {
  const parsed = ordenRecepcionAltaSchema.safeParse(raw);
  if (!parsed.success) return false;
  const o = parsed.data;

  return Boolean(
    o.motivoVisita?.trim() ||
      o.estadoIngresoNotas?.trim() ||
      o.firmaCliente?.trim() ||
      o.firmaAsesor?.trim() ||
      o.llegoGrua ||
      o.vehiculoSucio ||
      o.kilometraje != null ||
      o.checklist.some((c) => c.valor !== "no_aplica") ||
      o.danos.length > 0
  );
}

export function checklistToRecord(
  items: OrdenRecepcionChecklistRespuesta[]
): Record<string, OrdenRecepcionChecklistRespuesta["valor"]> {
  return Object.fromEntries(items.map((i) => [i.itemId, i.valor]));
}

export function recordToChecklist(
  record: Record<string, OrdenRecepcionChecklistRespuesta["valor"]>
): OrdenRecepcionChecklistRespuesta[] {
  return Object.entries(record).map(([itemId, valor]) => ({ itemId, valor }));
}
