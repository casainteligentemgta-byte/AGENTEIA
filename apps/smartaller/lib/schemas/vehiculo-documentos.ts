import { z } from "zod";

export const vehiculoDocumentoRefSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  scanned_at: z.string().optional(),
  file_name: z.string().optional(),
});

/** Documentos base + expediente Puerto Libre / importación / seguro. */
export const DOCUMENTO_TIPOS = [
  "cedula",
  "titulo",
  "factura_comercial",
  "bl_guia",
  "certificado_origen",
  "permiso_importacion",
  "nacionalizacion",
  "otro_importacion",
  "poliza_seguro",
  "certificado_seguro",
  "recibo_seguro",
  "rcv_seguro",
] as const;

export type DocumentoTipo = (typeof DOCUMENTO_TIPOS)[number];

export const documentoTipoSchema = z.enum(DOCUMENTO_TIPOS);

export const vehiculosDocumentosSchema = z.object({
  cedula: vehiculoDocumentoRefSchema.optional(),
  titulo: vehiculoDocumentoRefSchema.optional(),
  factura_comercial: vehiculoDocumentoRefSchema.optional(),
  bl_guia: vehiculoDocumentoRefSchema.optional(),
  certificado_origen: vehiculoDocumentoRefSchema.optional(),
  permiso_importacion: vehiculoDocumentoRefSchema.optional(),
  nacionalizacion: vehiculoDocumentoRefSchema.optional(),
  otro_importacion: vehiculoDocumentoRefSchema.optional(),
  poliza_seguro: vehiculoDocumentoRefSchema.optional(),
  certificado_seguro: vehiculoDocumentoRefSchema.optional(),
  recibo_seguro: vehiculoDocumentoRefSchema.optional(),
  rcv_seguro: vehiculoDocumentoRefSchema.optional(),
});

export type VehiculoDocumentoRef = z.infer<typeof vehiculoDocumentoRefSchema>;
export type VehiculosDocumentos = z.infer<typeof vehiculosDocumentosSchema>;

export function parseVehiculosDocumentos(raw: unknown): VehiculosDocumentos {
  const parsed = vehiculosDocumentosSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export const DOCUMENTO_LABELS: Record<DocumentoTipo, string> = {
  cedula: "Cédula del propietario",
  titulo: "Título de propiedad",
  factura_comercial: "Factura comercial",
  bl_guia: "BL / Guía de embarque",
  certificado_origen: "Certificado de origen",
  permiso_importacion: "Permiso de importación",
  nacionalizacion: "Nacionalización / aduana",
  otro_importacion: "Otro documento de importación",
  poliza_seguro: "Póliza de seguro",
  certificado_seguro: "Certificado de cobertura",
  recibo_seguro: "Recibo / pago de prima",
  rcv_seguro: "RCV / responsabilidad civil",
};

export const IMPORT_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "factura_comercial",
  "bl_guia",
  "certificado_origen",
  "permiso_importacion",
  "nacionalizacion",
  "titulo",
  "otro_importacion",
];

export const SEGURO_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "poliza_seguro",
  "certificado_seguro",
  "recibo_seguro",
  "rcv_seguro",
];

export const ESTADOS_NACIONALIZACION = [
  "pendiente",
  "en_proceso",
  "nacionalizado",
  "no_aplica",
] as const;

export const ESTADOS_SENIAT = [
  "pendiente",
  "agendada",
  "presentada",
  "no_aplica",
] as const;

export type EstadoNacionalizacion = (typeof ESTADOS_NACIONALIZACION)[number];
export type EstadoSeniat = (typeof ESTADOS_SENIAT)[number];

export const ESTADO_NACIONALIZACION_LABELS: Record<EstadoNacionalizacion, string> = {
  pendiente: "Pendiente de nacionalizar",
  en_proceso: "En proceso de nacionalización",
  nacionalizado: "Nacionalizado",
  no_aplica: "No aplica",
};

export const ESTADO_SENIAT_LABELS: Record<EstadoSeniat, string> = {
  pendiente: "Pendiente SENIAT",
  agendada: "Presentación SENIAT agendada",
  presentada: "Presentada en SENIAT",
  no_aplica: "SENIAT no aplica",
};

export const importacionSchema = z.object({
  regimen: z.string().trim().max(80).optional().nullable(),
  aduana: z.string().trim().max(120).optional().nullable(),
  fechaIngreso: z.string().trim().max(32).optional().nullable(),
  numeroBl: z.string().trim().max(80).optional().nullable(),
  paisOrigen: z.string().trim().max(80).optional().nullable(),
  valorCif: z.union([z.number(), z.nan()]).optional().nullable(),
  agenteAduanal: z.string().trim().max(120).optional().nullable(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
  estadoNacionalizacion: z.enum(ESTADOS_NACIONALIZACION).optional().nullable(),
  fechaLimiteNacionalizacion: z.string().trim().max(32).optional().nullable(),
  estadoSeniat: z.enum(ESTADOS_SENIAT).optional().nullable(),
  fechaPresentacionSeniat: z.string().trim().max(32).optional().nullable(),
});

export type ImportacionData = z.infer<typeof importacionSchema>;

function asOptionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function parseImportacion(raw: unknown): ImportacionData {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const parsed = importacionSchema.safeParse({
    regimen: row.regimen ?? row.regimen_importacion,
    aduana: row.aduana,
    fechaIngreso: row.fechaIngreso ?? row.fecha_ingreso,
    numeroBl: row.numeroBl ?? row.numero_bl,
    paisOrigen: row.paisOrigen ?? row.pais_origen,
    valorCif:
      typeof row.valorCif === "number"
        ? row.valorCif
        : typeof row.valor_cif === "number"
          ? row.valor_cif
          : row.valorCif ?? row.valor_cif,
    agenteAduanal: row.agenteAduanal ?? row.agente_aduanal,
    observaciones: row.observaciones,
    estadoNacionalizacion: asOptionalEnum(
      row.estadoNacionalizacion ?? row.estado_nacionalizacion,
      ESTADOS_NACIONALIZACION
    ),
    fechaLimiteNacionalizacion:
      row.fechaLimiteNacionalizacion ?? row.fecha_limite_nacionalizacion,
    estadoSeniat: asOptionalEnum(
      row.estadoSeniat ?? row.estado_seniat,
      ESTADOS_SENIAT
    ),
    fechaPresentacionSeniat:
      row.fechaPresentacionSeniat ?? row.fecha_presentacion_seniat,
  });
  return parsed.success ? parsed.data : {};
}

export function serializeImportacion(data: ImportacionData): Record<string, unknown> {
  return {
    regimen: data.regimen?.trim() || null,
    aduana: data.aduana?.trim() || null,
    fecha_ingreso: data.fechaIngreso?.trim() || null,
    numero_bl: data.numeroBl?.trim() || null,
    pais_origen: data.paisOrigen?.trim() || null,
    valor_cif:
      data.valorCif != null && !Number.isNaN(data.valorCif) ? data.valorCif : null,
    agente_aduanal: data.agenteAduanal?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    estado_nacionalizacion: data.estadoNacionalizacion || null,
    fecha_limite_nacionalizacion: data.fechaLimiteNacionalizacion?.trim() || null,
    estado_seniat: data.estadoSeniat || null,
    fecha_presentacion_seniat: data.fechaPresentacionSeniat?.trim() || null,
  };
}

/** Días hasta una fecha ISO `YYYY-MM-DD` (negativo = vencido). */
export function diasHasta(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!match) return null;
  const target = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function esProximoNacionalizar(data: ImportacionData): boolean {
  const estado = data.estadoNacionalizacion ?? "pendiente";
  return estado === "pendiente" || estado === "en_proceso";
}

export function esProximoSeniat(data: ImportacionData): boolean {
  const estado = data.estadoSeniat ?? "pendiente";
  return estado === "pendiente" || estado === "agendada";
}

export const seguroSchema = z.object({
  aseguradora: z.string().trim().max(120).optional().nullable(),
  numeroPoliza: z.string().trim().max(80).optional().nullable(),
  tipoCobertura: z.string().trim().max(80).optional().nullable(),
  vigenciaDesde: z.string().trim().max(32).optional().nullable(),
  vigenciaHasta: z.string().trim().max(32).optional().nullable(),
  montoAsegurado: z.union([z.number(), z.nan()]).optional().nullable(),
  telefonoAseguradora: z.string().trim().max(40).optional().nullable(),
  corredor: z.string().trim().max(120).optional().nullable(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
});

export type SeguroData = z.infer<typeof seguroSchema>;

export function parseSeguro(raw: unknown): SeguroData {
  if (!raw || typeof raw !== "object") return {};
  const row = raw as Record<string, unknown>;
  const parsed = seguroSchema.safeParse({
    aseguradora: row.aseguradora,
    numeroPoliza: row.numeroPoliza ?? row.numero_poliza,
    tipoCobertura: row.tipoCobertura ?? row.tipo_cobertura,
    vigenciaDesde: row.vigenciaDesde ?? row.vigencia_desde,
    vigenciaHasta: row.vigenciaHasta ?? row.vigencia_hasta,
    montoAsegurado:
      typeof row.montoAsegurado === "number"
        ? row.montoAsegurado
        : typeof row.monto_asegurado === "number"
          ? row.monto_asegurado
          : row.montoAsegurado ?? row.monto_asegurado,
    telefonoAseguradora: row.telefonoAseguradora ?? row.telefono_aseguradora,
    corredor: row.corredor,
    observaciones: row.observaciones,
  });
  return parsed.success ? parsed.data : {};
}

export function serializeSeguro(data: SeguroData): Record<string, unknown> {
  return {
    aseguradora: data.aseguradora?.trim() || null,
    numero_poliza: data.numeroPoliza?.trim() || null,
    tipo_cobertura: data.tipoCobertura?.trim() || null,
    vigencia_desde: data.vigenciaDesde?.trim() || null,
    vigencia_hasta: data.vigenciaHasta?.trim() || null,
    monto_asegurado:
      data.montoAsegurado != null && !Number.isNaN(data.montoAsegurado)
        ? data.montoAsegurado
        : null,
    telefono_aseguradora: data.telefonoAseguradora?.trim() || null,
    corredor: data.corredor?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
  };
}
