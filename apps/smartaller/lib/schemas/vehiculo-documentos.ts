import { z } from "zod";

export const vehiculoDocumentoRefSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  scanned_at: z.string().optional(),
  file_name: z.string().optional(),
});

/** Documentos base + expediente Puerto Libre / importación / seguro / memoria fotográfica. */
export const DOCUMENTO_TIPOS = [
  "cedula",
  "titulo",
  "factura_comercial",
  "bl_guia",
  "certificado_origen",
  "permiso_importacion",
  "nacionalizacion",
  "documento_importacion",
  "manual_vehiculo",
  "otro_importacion",
  "poliza_seguro",
  "certificado_seguro",
  "recibo_seguro",
  "rcv_seguro",
  "foto_frontal",
  "foto_trasera",
  "foto_lateral_izq",
  "foto_lateral_der",
  "foto_vin",
  "foto_odometro",
  "foto_danos",
  "foto_motor",
  "foto_impronta",
  "foto_placa",
  "foto_comprador",
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
  documento_importacion: vehiculoDocumentoRefSchema.optional(),
  manual_vehiculo: vehiculoDocumentoRefSchema.optional(),
  otro_importacion: vehiculoDocumentoRefSchema.optional(),
  poliza_seguro: vehiculoDocumentoRefSchema.optional(),
  certificado_seguro: vehiculoDocumentoRefSchema.optional(),
  recibo_seguro: vehiculoDocumentoRefSchema.optional(),
  rcv_seguro: vehiculoDocumentoRefSchema.optional(),
  foto_frontal: vehiculoDocumentoRefSchema.optional(),
  foto_trasera: vehiculoDocumentoRefSchema.optional(),
  foto_lateral_izq: vehiculoDocumentoRefSchema.optional(),
  foto_lateral_der: vehiculoDocumentoRefSchema.optional(),
  foto_vin: vehiculoDocumentoRefSchema.optional(),
  foto_odometro: vehiculoDocumentoRefSchema.optional(),
  foto_danos: vehiculoDocumentoRefSchema.optional(),
  foto_motor: vehiculoDocumentoRefSchema.optional(),
  foto_impronta: vehiculoDocumentoRefSchema.optional(),
  foto_placa: vehiculoDocumentoRefSchema.optional(),
  foto_comprador: vehiculoDocumentoRefSchema.optional(),
});

export type VehiculoDocumentoRef = z.infer<typeof vehiculoDocumentoRefSchema>;
export type VehiculosDocumentos = z.infer<typeof vehiculosDocumentosSchema>;

export function parseVehiculosDocumentos(raw: unknown): VehiculosDocumentos {
  const parsed = vehiculosDocumentosSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export const DOCUMENTO_LABELS: Record<DocumentoTipo, string> = {
  cedula: "Cédula del comprador",
  titulo: "Título de propiedad",
  factura_comercial: "Factura",
  bl_guia: "BL / Guía de embarque",
  certificado_origen: "Certificado de origen",
  permiso_importacion: "Permiso de importación",
  nacionalizacion: "Nacionalización / aduana",
  documento_importacion: "Documento de importación",
  manual_vehiculo: "Manual del vehículo",
  otro_importacion: "Otro documento de importación",
  poliza_seguro: "Póliza de seguro",
  certificado_seguro: "Certificado de cobertura",
  recibo_seguro: "Recibo / pago de prima",
  rcv_seguro: "RCV / responsabilidad civil",
  foto_frontal: "Foto frontal",
  foto_trasera: "Foto trasera",
  foto_lateral_izq: "Foto lateral izquierdo",
  foto_lateral_der: "Foto lateral derecho",
  foto_vin: "Foto VIN / chasis",
  foto_odometro: "Foto tablero con kilometraje",
  foto_danos: "Foto de daños (si aplica)",
  foto_motor: "Foto del motor",
  foto_impronta: "Foto de la impronta",
  foto_placa: "Foto de la placa",
  foto_comprador: "Foto del comprador",
};

/** Documentos de importación (fase 3). */
export const PL_REGISTRO_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "manual_vehiculo",
  "bl_guia",
  "factura_comercial",
  "documento_importacion",
];

export const IMPORT_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "factura_comercial",
  "bl_guia",
  "certificado_origen",
  "permiso_importacion",
  "documento_importacion",
  "manual_vehiculo",
  "nacionalizacion",
  "titulo",
  "otro_importacion",
];

/** Memoria fotográfica al llegar el vehículo (fase 2). */
export const MEMORIA_FOTOGRAFICA_TIPOS: DocumentoTipo[] = [
  "foto_frontal",
  "foto_trasera",
  "foto_lateral_izq",
  "foto_lateral_der",
  "foto_motor",
  "foto_impronta",
  "foto_odometro",
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
  /** Año del vehículo (modelo). */
  anio: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  importadorNombre: z.string().trim().max(120).optional().nullable(),
  importadorDocumento: z.string().trim().max(40).optional().nullable(),
  importadorTelefono: z.string().trim().max(40).optional().nullable(),
  importadorEmail: z.string().trim().max(120).optional().nullable(),
  /** 2 = llegada, 3 = docs/comprador/seguro, 4 = planilla completa. */
  planillaFase: z.coerce.number().int().min(1).max(4).optional().nullable(),
  /** Código de expediente PL-Año.Mes.Número (ej. PL-2026.6.3). */
  codigoExpediente: z.string().trim().max(32).optional().nullable(),
  /** Número secuencial del expediente dentro del mes. */
  numeroExpediente: z.coerce.number().int().min(1).optional().nullable(),
  /** Checklist de llegada (fase 2). */
  checklistLlegada: z.record(z.string()).optional().nullable(),
  /** Notas de daño por ítem del checklist de llegada. */
  checklistLlegadaNotas: z.record(z.string()).optional().nullable(),
  /** Notas de otros dispositivos (fase 2). */
  otrosDispositivosNotas: z.string().trim().max(500).optional().nullable(),
  /** Dirección del comprador (fase 3). */
  compradorDireccion: z.string().trim().max(240).optional().nullable(),
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

function asOptionalAnio(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
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
    anio: asOptionalAnio(row.anio ?? row.anio_vehiculo),
    importadorNombre: row.importadorNombre ?? row.importador_nombre,
    importadorDocumento: row.importadorDocumento ?? row.importador_documento,
    importadorTelefono: row.importadorTelefono ?? row.importador_telefono,
    importadorEmail: row.importadorEmail ?? row.importador_email,
    planillaFase: asOptionalAnio(row.planillaFase ?? row.planilla_fase),
    codigoExpediente: row.codigoExpediente ?? row.codigo_expediente,
    numeroExpediente: asOptionalAnio(row.numeroExpediente ?? row.numero_expediente),
    checklistLlegada:
      row.checklistLlegada && typeof row.checklistLlegada === "object"
        ? (row.checklistLlegada as Record<string, string>)
        : row.checklist_llegada && typeof row.checklist_llegada === "object"
          ? (row.checklist_llegada as Record<string, string>)
          : null,
    checklistLlegadaNotas:
      row.checklistLlegadaNotas && typeof row.checklistLlegadaNotas === "object"
        ? (row.checklistLlegadaNotas as Record<string, string>)
        : row.checklist_llegada_notas && typeof row.checklist_llegada_notas === "object"
          ? (row.checklist_llegada_notas as Record<string, string>)
          : null,
    otrosDispositivosNotas:
      row.otrosDispositivosNotas ?? row.otros_dispositivos_notas,
    compradorDireccion: row.compradorDireccion ?? row.comprador_direccion,
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
    anio: data.anio != null && !Number.isNaN(data.anio) ? data.anio : null,
    importador_nombre: data.importadorNombre?.trim() || null,
    importador_documento: data.importadorDocumento?.trim() || null,
    importador_telefono: data.importadorTelefono?.trim() || null,
    importador_email: data.importadorEmail?.trim() || null,
    planilla_fase:
      data.planillaFase != null && !Number.isNaN(data.planillaFase)
        ? data.planillaFase
        : null,
    codigo_expediente: data.codigoExpediente?.trim() || null,
    numero_expediente:
      data.numeroExpediente != null && !Number.isNaN(data.numeroExpediente)
        ? data.numeroExpediente
        : null,
    checklist_llegada: data.checklistLlegada ?? null,
    checklist_llegada_notas: data.checklistLlegadaNotas ?? null,
    otros_dispositivos_notas: data.otrosDispositivosNotas?.trim() || null,
    comprador_direccion: data.compradorDireccion?.trim() || null,
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
  /** Equipos / dispositivos de seguridad del vehículo */
  tieneAlarma: z.boolean().optional().nullable(),
  tieneGps: z.boolean().optional().nullable(),
  tieneInmovilizador: z.boolean().optional().nullable(),
  dispositivosSeguridad: z.string().trim().max(500).optional().nullable(),
  contactoEmergencia: z.string().trim().max(120).optional().nullable(),
  telefonoEmergencia: z.string().trim().max(40).optional().nullable(),
});

export type SeguroData = z.infer<typeof seguroSchema>;

function asOptionalBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
}

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
    tieneAlarma: asOptionalBool(row.tieneAlarma ?? row.tiene_alarma),
    tieneGps: asOptionalBool(row.tieneGps ?? row.tiene_gps),
    tieneInmovilizador: asOptionalBool(
      row.tieneInmovilizador ?? row.tiene_inmovilizador
    ),
    dispositivosSeguridad:
      row.dispositivosSeguridad ?? row.dispositivos_seguridad,
    contactoEmergencia: row.contactoEmergencia ?? row.contacto_emergencia,
    telefonoEmergencia: row.telefonoEmergencia ?? row.telefono_emergencia,
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
    tiene_alarma: data.tieneAlarma ?? null,
    tiene_gps: data.tieneGps ?? null,
    tiene_inmovilizador: data.tieneInmovilizador ?? null,
    dispositivos_seguridad: data.dispositivosSeguridad?.trim() || null,
    contacto_emergencia: data.contactoEmergencia?.trim() || null,
    telefono_emergencia: data.telefonoEmergencia?.trim() || null,
  };
}
