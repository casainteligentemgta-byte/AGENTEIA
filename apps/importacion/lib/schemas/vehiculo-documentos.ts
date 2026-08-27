import { z } from "zod";
import {
  getRegimenConfig,
  resolveRegimenImportacion,
} from "@/lib/importacion/regimenes";

export const vehiculoDocumentoRefSchema = z.object({
  url: z.string().url(),
  path: z.string().min(1),
  scanned_at: z.string().optional(),
  file_name: z.string().optional(),
});

/** Documentos base + expediente Puerto Libre / importación / seguro / memoria fotográfica. */
export const DOCUMENTO_TIPOS = [
  "cedula",
  "cedula_importador",
  "rif_importador",
  "titulo",
  "factura_comercial",
  "bl_guia",
  "certificado_origen",
  "lista_empaque",
  "dav",
  "poliza_transporte",
  "permiso_importacion",
  "nacionalizacion",
  "declaracion_jurada_origen_fondos",
  "planilla_liquidacion_aduanera",
  "licencia_importacion_automotriz",
  "certificado_uso_consular",
  "oficio_exoneracion_seniat",
  "pasaporte_propietario",
  "declaracion_jurada_propietario",
  "franquicia_diplomatica",
  "facilidad_diplomatica",
  "autorizacion_admision_temporal",
  "documento_importacion",
  "manual_vehiculo",
  "otro_importacion",
  "acta_recepcion_mercancia",
  "constancia_edi_reconocimiento",
  "sencamer",
  "registro_puerto_libre",
  "agente_aduanal_doc",
  "pase_salida_levante",
  "cancelacion_gastos_portuarios",
  "nota_levante_seniat",
  "poliza_seguro",
  "certificado_seguro",
  "recibo_seguro",
  "rcv_seguro",
  "experticia_verificacion_legal",
  "inspeccion_pnb",
  "homologacion",
  "planilla_sumica_put",
  "pago_tasas",
  "declaracion_complementaria",
  "liquidacion_nacionalizacion",
  "resolucion_liberacion_seniat",
  "constancia_residencia_permanencia",
  "solicitud_levantamiento_intt",
  "titulo_libre_circulacion",
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
  cedula_importador: vehiculoDocumentoRefSchema.optional(),
  rif_importador: vehiculoDocumentoRefSchema.optional(),
  titulo: vehiculoDocumentoRefSchema.optional(),
  factura_comercial: vehiculoDocumentoRefSchema.optional(),
  bl_guia: vehiculoDocumentoRefSchema.optional(),
  certificado_origen: vehiculoDocumentoRefSchema.optional(),
  lista_empaque: vehiculoDocumentoRefSchema.optional(),
  dav: vehiculoDocumentoRefSchema.optional(),
  poliza_transporte: vehiculoDocumentoRefSchema.optional(),
  permiso_importacion: vehiculoDocumentoRefSchema.optional(),
  nacionalizacion: vehiculoDocumentoRefSchema.optional(),
  declaracion_jurada_origen_fondos: vehiculoDocumentoRefSchema.optional(),
  planilla_liquidacion_aduanera: vehiculoDocumentoRefSchema.optional(),
  licencia_importacion_automotriz: vehiculoDocumentoRefSchema.optional(),
  certificado_uso_consular: vehiculoDocumentoRefSchema.optional(),
  oficio_exoneracion_seniat: vehiculoDocumentoRefSchema.optional(),
  pasaporte_propietario: vehiculoDocumentoRefSchema.optional(),
  declaracion_jurada_propietario: vehiculoDocumentoRefSchema.optional(),
  franquicia_diplomatica: vehiculoDocumentoRefSchema.optional(),
  facilidad_diplomatica: vehiculoDocumentoRefSchema.optional(),
  autorizacion_admision_temporal: vehiculoDocumentoRefSchema.optional(),
  documento_importacion: vehiculoDocumentoRefSchema.optional(),
  manual_vehiculo: vehiculoDocumentoRefSchema.optional(),
  otro_importacion: vehiculoDocumentoRefSchema.optional(),
  acta_recepcion_mercancia: vehiculoDocumentoRefSchema.optional(),
  constancia_edi_reconocimiento: vehiculoDocumentoRefSchema.optional(),
  sencamer: vehiculoDocumentoRefSchema.optional(),
  registro_puerto_libre: vehiculoDocumentoRefSchema.optional(),
  agente_aduanal_doc: vehiculoDocumentoRefSchema.optional(),
  pase_salida_levante: vehiculoDocumentoRefSchema.optional(),
  cancelacion_gastos_portuarios: vehiculoDocumentoRefSchema.optional(),
  nota_levante_seniat: vehiculoDocumentoRefSchema.optional(),
  poliza_seguro: vehiculoDocumentoRefSchema.optional(),
  certificado_seguro: vehiculoDocumentoRefSchema.optional(),
  recibo_seguro: vehiculoDocumentoRefSchema.optional(),
  rcv_seguro: vehiculoDocumentoRefSchema.optional(),
  experticia_verificacion_legal: vehiculoDocumentoRefSchema.optional(),
  inspeccion_pnb: vehiculoDocumentoRefSchema.optional(),
  homologacion: vehiculoDocumentoRefSchema.optional(),
  planilla_sumica_put: vehiculoDocumentoRefSchema.optional(),
  pago_tasas: vehiculoDocumentoRefSchema.optional(),
  declaracion_complementaria: vehiculoDocumentoRefSchema.optional(),
  liquidacion_nacionalizacion: vehiculoDocumentoRefSchema.optional(),
  resolucion_liberacion_seniat: vehiculoDocumentoRefSchema.optional(),
  constancia_residencia_permanencia: vehiculoDocumentoRefSchema.optional(),
  solicitud_levantamiento_intt: vehiculoDocumentoRefSchema.optional(),
  titulo_libre_circulacion: vehiculoDocumentoRefSchema.optional(),
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
  cedula_importador: "Cédula del importador",
  rif_importador: "RIF del importador (dir. Nueva Esparta, Venezuela)",
  titulo: "Título de propiedad",
  factura_comercial: "Factura de compra",
  bl_guia: "BL / Guía",
  certificado_origen: "Certificado de origen",
  lista_empaque: "Lista de empaque",
  dav: "Declaración Andina de Valor (DAV)",
  poliza_transporte: "Póliza de transporte",
  permiso_importacion: "Permiso de importación",
  nacionalizacion: "Declaración Única de Aduanas (DUA)",
  declaracion_jurada_origen_fondos: "Declaración jurada de origen de fondos",
  planilla_liquidacion_aduanera:
    "Planilla de liquidación de impuestos y tasas aduaneras",
  licencia_importacion_automotriz: "Licencia de importación automotriz",
  certificado_uso_consular: "Certificado de uso (consular)",
  oficio_exoneracion_seniat: "Oficio de exoneración SENIAT",
  pasaporte_propietario: "Pasaporte del propietario",
  declaracion_jurada_propietario: "Declaración jurada del propietario",
  franquicia_diplomatica: "Franquicia diplomática (MPPRE)",
  facilidad_diplomatica: "Facilidad diplomática (MPPRE)",
  autorizacion_admision_temporal: "Autorización de admisión temporal",
  documento_importacion: "Documento de importación",
  manual_vehiculo: "Manual del vehículo",
  otro_importacion: "Otro documento de importación",
  acta_recepcion_mercancia: "Acta de recepción (AR)",
  constancia_edi_reconocimiento:
    "Reconocimiento / constancia del estado de la carga",
  sencamer: "SENCAMER",
  registro_puerto_libre: "Registro de Puerto Libre",
  agente_aduanal_doc: "Constancia del agente aduanal",
  pase_salida_levante: "Pase de salida y levante",
  cancelacion_gastos_portuarios:
    "Cancelación de gastos portuarios, almacén y manipulación",
  nota_levante_seniat: "Nota del levante (SENIAT)",
  poliza_seguro: "Póliza de seguro del vehículo",
  certificado_seguro: "Certificado de cobertura",
  recibo_seguro: "Recibo / pago de prima",
  rcv_seguro: "Póliza RCV / responsabilidad civil",
  experticia_verificacion_legal: "Constancia de experticia de verificación legal",
  inspeccion_pnb: "Inspección PNB",
  homologacion: "Homologación",
  planilla_sumica_put: "PUT (planilla SUMICA)",
  pago_tasas: "Planilla de pago",
  declaracion_complementaria: "Declaración complementaria SENIAT",
  liquidacion_nacionalizacion: "Liquidación / pago de nacionalización",
  resolucion_liberacion_seniat: "Resolución de liberación SENIAT",
  constancia_residencia_permanencia: "Constancia de residencia / permanencia",
  solicitud_levantamiento_intt: "Solicitud de levantamiento INTT",
  titulo_libre_circulacion: "Título de libre circulación nacional",
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

/**
 * Documentos de fase 1 (Registro): factura de compra y certificado de origen.
 */
export const PL_FASE1_REGISTRO_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "factura_comercial",
  "certificado_origen",
];

/**
 * Documentos de fase 2 (Embarque): BL, lista de empaque y póliza de transporte.
 * La DAV se carga en desaduanamiento.
 * La póliza se muestra en la UI pero no es obligatoria para avanzar a Llegada.
 */
export const PL_EMBARQUE_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "bl_guia",
  "lista_empaque",
  "poliza_transporte",
];

/** Mínimo para completar Fase 2 y continuar a Llegada. */
export const PL_EMBARQUE_DOCUMENTO_TIPOS_OBLIGATORIOS: DocumentoTipo[] = [
  "bl_guia",
  "lista_empaque",
];

/**
 * Documentos de llegada (fase 3 UI): AR y constancia EDI / reconocimiento.
 */
export const PL_LLEGADA_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "acta_recepcion_mercancia",
  "constancia_edi_reconocimiento",
];

/**
 * Carpeta completa de desaduanamiento (fase 4 UI).
 * Incluye el pase de salida (se carga en pantalla pero NO va al Expediente PDF).
 * Registro PL solo aplica a importador jurídico (se filtra en runtime).
 */
export const PL_DESADUANAMIENTO_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "cedula_importador",
  "rif_importador",
  "lista_empaque",
  "nacionalizacion",
  "dav",
  "sencamer",
  "registro_puerto_libre",
  "agente_aduanal_doc",
  "constancia_edi_reconocimiento",
  "planilla_liquidacion_aduanera",
  "constancia_residencia_permanencia",
  "pase_salida_levante",
];

/** Documento de salida: misma pantalla, fuera del Expediente PDF SENIAT. */
export const PL_PASE_SALIDA_TIPO: DocumentoTipo = "pase_salida_levante";

/** @deprecated Usar PL_DESADUANAMIENTO_DOCUMENTO_TIPOS. */
export const PL_ADUANA_DOCUMENTO_TIPOS = PL_DESADUANAMIENTO_DOCUMENTO_TIPOS;

/** Solo los que suelen cargarse por primera vez en desaduanamiento. */
export const PL_DESADUANAMIENTO_NUEVOS_TIPOS: DocumentoTipo[] = [
  "cedula_importador",
  "rif_importador",
  "nacionalizacion",
  "dav",
  "sencamer",
  "registro_puerto_libre",
  "agente_aduanal_doc",
  "planilla_liquidacion_aduanera",
  "constancia_residencia_permanencia",
  "pase_salida_levante",
];

export const PL_DESADUANAMIENTO_ORIGEN: Partial<Record<DocumentoTipo, string>> = {
  cedula_importador: "Cédula del importador (si ya está cargada, puedes reemplazarla)",
  rif_importador:
    "RIF con dirección en Nueva Esparta, Venezuela (si ya está cargado, puedes reemplazarlo)",
  lista_empaque: "Desde fase Embarque (lista de empaque)",
  nacionalizacion: "Declaración Única de Aduanas (DUA) ante SENIAT",
  dav: "Declaración Andina de Valor (DAV)",
  sencamer: "Certificado / documento SENCAMER",
  registro_puerto_libre:
    "Registro de Puerto Libre (solo importador persona jurídica)",
  agente_aduanal_doc: "Constancia / documento del Agente de Aduanas autorizado",
  constancia_edi_reconocimiento:
    "Desde fase Llegada (Reconocimiento / constancia del estado de la carga)",
  planilla_liquidacion_aduanera:
    "Pago de tasas o impuestos / planilla de liquidación aduanera",
  constancia_residencia_permanencia:
    "Constancia de residencia permanente en zona de Puerto Libre",
  pase_salida_levante:
    "Pase de salida y levante — se carga aparte; no forma parte del Expediente PDF",
  cancelacion_gastos_portuarios:
    "Cancelación de gastos portuarios, almacén y manipulación",
  nota_levante_seniat: "Emisión de la nota del levante por el SENIAT",
};

/** Docs de registro + embarque + desaduanamiento (conteo faltantes en listados). */
export const PL_REGISTRO_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  ...PL_FASE1_REGISTRO_DOCUMENTO_TIPOS,
  ...PL_EMBARQUE_DOCUMENTO_TIPOS,
  ...PL_DESADUANAMIENTO_NUEVOS_TIPOS,
];

export const IMPORT_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "factura_comercial",
  "certificado_origen",
  "bl_guia",
  "lista_empaque",
  "dav",
  "poliza_transporte",
  "permiso_importacion",
  "documento_importacion",
  "manual_vehiculo",
  "nacionalizacion",
  "declaracion_jurada_origen_fondos",
  "planilla_liquidacion_aduanera",
  "licencia_importacion_automotriz",
  "certificado_uso_consular",
  "oficio_exoneracion_seniat",
  "pasaporte_propietario",
  "declaracion_jurada_propietario",
  "franquicia_diplomatica",
  "facilidad_diplomatica",
  "autorizacion_admision_temporal",
  "acta_recepcion_mercancia",
  "constancia_edi_reconocimiento",
  "cedula_importador",
  "rif_importador",
  "sencamer",
  "registro_puerto_libre",
  "agente_aduanal_doc",
  "pase_salida_levante",
  "cancelacion_gastos_portuarios",
  "nota_levante_seniat",
  "experticia_verificacion_legal",
  "inspeccion_pnb",
  "homologacion",
  "planilla_sumica_put",
  "pago_tasas",
  "declaracion_complementaria",
  "liquidacion_nacionalizacion",
  "resolucion_liberacion_seniat",
  "constancia_residencia_permanencia",
  "solicitud_levantamiento_intt",
  "titulo_libre_circulacion",
  "titulo",
  "otro_importacion",
];

/** Memoria descriptiva (fotos) al llegar el vehículo (fase Llegada). */
export const MEMORIA_FOTOGRAFICA_TIPOS: DocumentoTipo[] = [
  "foto_frontal",
  "foto_trasera",
  "foto_lateral_izq",
  "foto_lateral_der",
  "foto_motor",
  "foto_impronta",
  "foto_odometro",
];

/**
 * Fotos obligatorias para completar Llegada.
 * `foto_impronta` es opcional (si se carga, se verifica el serial).
 */
export const MEMORIA_FOTOGRAFICA_TIPOS_OBLIGATORIOS: DocumentoTipo[] =
  MEMORIA_FOTOGRAFICA_TIPOS.filter((t) => t !== "foto_impronta");

export const SEGURO_DOCUMENTO_TIPOS: DocumentoTipo[] = [
  "poliza_seguro",
  "certificado_seguro",
  "recibo_seguro",
  "rcv_seguro",
];

/**
 * Matriculación INTT (fase 7): solo docs propios de esta fase.
 * Homologación es opcional según el vehículo (`requiereHomologacion`).
 * El resto del expediente se cargó en fases anteriores.
 */
export const PL_MATRICULACION_CARGAR_TIPOS: DocumentoTipo[] = [
  "inspeccion_pnb",
  "planilla_sumica_put",
];

/**
 * Recaudos de fases anteriores: solo referencia en Matriculación (sin re-cargar).
 * Se incluyen en el PDF de carpeta INTT si ya están en el expediente.
 */
export const PL_MATRICULACION_REFERENCIA_TIPOS: DocumentoTipo[] = [
  "factura_comercial",
  "bl_guia",
  "nacionalizacion",
  "rcv_seguro",
  "cedula_importador",
  "rif_importador",
  "constancia_residencia_permanencia",
];

/** @deprecated Usar PL_MATRICULACION_REFERENCIA_TIPOS. */
export const PL_MATRICULACION_FISICO_TIPOS = PL_MATRICULACION_REFERENCIA_TIPOS;

/** Liquidación o oficio de exención SENIAT: basta con uno. */
export const PL_MATRICULACION_LIQUIDACION_EXENCION_TIPOS: DocumentoTipo[] = [
  "planilla_liquidacion_aduanera",
  "oficio_exoneracion_seniat",
];

/**
 * Entrega INTT (título / foto placa): no se cargan en Matriculación.
 * @deprecated Fuera del alcance de la fase Matriculación.
 */
export const PL_MATRICULACION_ENTREGA_TIPOS: DocumentoTipo[] = [
  "titulo",
  "foto_placa",
];

/**
 * Docs que se cargan por primera vez en matriculación
 * (homologación solo si aplica).
 */
export const PL_MATRICULACION_NUEVOS_TIPOS: DocumentoTipo[] = [
  "inspeccion_pnb",
  "homologacion",
  "planilla_sumica_put",
  "planilla_liquidacion_aduanera",
  "oficio_exoneracion_seniat",
];

export const PL_MATRICULACION_ORIGEN: Partial<Record<DocumentoTipo, string>> = {
  factura_comercial: "Desde fase Registro",
  bl_guia: "Desde fase Embarque",
  nacionalizacion: "Desde fase Desaduanamiento (DUA)",
  rcv_seguro: "Desde fase Seguro",
  cedula_importador: "Desde fase Desaduanamiento",
  rif_importador: "Desde fase Desaduanamiento",
  constancia_residencia_permanencia: "Desde fase Desaduanamiento",
  planilla_liquidacion_aduanera: "Liquidación de impuestos / tasas aduaneras",
  oficio_exoneracion_seniat: "Oficio de exención / exoneración del SENIAT",
  inspeccion_pnb: "Inspección de la Policía Nacional Bolivariana",
  homologacion: "Solo si el vehículo lo requiere",
  planilla_sumica_put: "Planilla única de trámite (PUT / SUMICA)",
};

/**
 * Orden de documentos del PDF de Matriculación INTT:
 * referencias previas + docs cargados en esta fase.
 */
export function docsMatriculacionPdfTipos(
  requiereHomologacion: boolean
): DocumentoTipo[] {
  const seen = new Set<DocumentoTipo>();
  const out: DocumentoTipo[] = [];
  const push = (tipo: DocumentoTipo) => {
    if (seen.has(tipo)) return;
    seen.add(tipo);
    out.push(tipo);
  };
  for (const t of PL_MATRICULACION_REFERENCIA_TIPOS) push(t);
  for (const t of tiposMatriculacionBase(requiereHomologacion)) push(t);
  for (const t of PL_MATRICULACION_LIQUIDACION_EXENCION_TIPOS) push(t);
  return out;
}

/** Tipos obligatorios de carpeta (sin liquidación/exención ni homologación). */
export function tiposMatriculacionBase(
  requiereHomologacion: boolean
): DocumentoTipo[] {
  return [
    ...PL_MATRICULACION_CARGAR_TIPOS,
    ...(requiereHomologacion ? (["homologacion"] as const) : []),
  ];
}

export function tieneLiquidacionOExencion(
  docs: VehiculosDocumentos
): boolean {
  return PL_MATRICULACION_LIQUIDACION_EXENCION_TIPOS.some((t) =>
    Boolean(docs[t]?.url)
  );
}

/** Faltantes de matriculación (PNB, PUT, homologación si aplica, liquidación/oficio). */
export function faltantesMatriculacionCarpeta(
  docs: VehiculosDocumentos,
  requiereHomologacion: boolean
): DocumentoTipo[] {
  const faltantes = tiposMatriculacionBase(requiereHomologacion).filter(
    (t) => !docs[t]?.url
  );
  if (!tieneLiquidacionOExencion(docs)) {
    faltantes.push("planilla_liquidacion_aduanera");
  }
  return faltantes;
}

export function countMatriculacionCarpeta(
  docs: VehiculosDocumentos,
  requiereHomologacion: boolean
): { listos: number; total: number } {
  const base = tiposMatriculacionBase(requiereHomologacion);
  const baseListos = base.filter((t) => docs[t]?.url).length;
  const liq = tieneLiquidacionOExencion(docs) ? 1 : 0;
  return { listos: baseListos + liq, total: base.length + 1 };
}

/**
 * @deprecated Usar tiposMatriculacionBase + liquidación/exención.
 */
export const PL_MATRICULACION_CARPETA_TIPOS: DocumentoTipo[] = [
  ...PL_MATRICULACION_CARGAR_TIPOS,
];

/** Vías de nacionalización desde Puerto Libre. */
export const VIAS_NACIONALIZACION = ["cambio_regimen", "permanencia"] as const;
export type ViaNacionalizacion = (typeof VIAS_NACIONALIZACION)[number];

export const VIA_NACIONALIZACION_LABELS: Record<ViaNacionalizacion, string> = {
  cambio_regimen: "Cambio de régimen (< 3 años)",
  permanencia: "Liberación por permanencia (≥ 3 años)",
};

/**
 * Docs a cargar en nacionalización por cambio de régimen (M2).
 * Reutiliza factura/origen/DUA del expediente; aquí van los nuevos.
 * Incluye constancia de residencia / permanencia (recaudo de nacionalización).
 */
export const PL_NACIONALIZACION_M2_TIPOS: DocumentoTipo[] = [
  "declaracion_complementaria",
  "constancia_residencia_permanencia",
  "liquidacion_nacionalizacion",
  "resolucion_liberacion_seniat",
  "solicitud_levantamiento_intt",
  "titulo_libre_circulacion",
];

/** Docs a cargar en liberación por permanencia (M3). */
export const PL_NACIONALIZACION_M3_TIPOS: DocumentoTipo[] = [
  "constancia_residencia_permanencia",
  "liquidacion_nacionalizacion",
  "resolucion_liberacion_seniat",
  "solicitud_levantamiento_intt",
  "titulo_libre_circulacion",
];

/** Docs del expediente PL que se muestran como base (solo lectura / reutilizar). */
export const PL_NACIONALIZACION_BASE_TIPOS: DocumentoTipo[] = [
  "factura_comercial",
  "certificado_origen",
  "nacionalizacion",
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
  "rechazada",
  "no_aplica",
] as const;

export type EstadoNacionalizacion = (typeof ESTADOS_NACIONALIZACION)[number];
export type EstadoSeniat = (typeof ESTADOS_SENIAT)[number];

/** Tránsito aduanero / USO24 en datos de importación. */
export const MODALIDADES_TRANSITO = ["ninguno", "transito", "uso24"] as const;
export type ModalidadTransito = (typeof MODALIDADES_TRANSITO)[number];

export const MODALIDAD_TRANSITO_LABELS: Record<ModalidadTransito, string> = {
  ninguno: "Sin tránsito / USO24",
  transito: "Tránsito",
  uso24: "USO24",
};

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
  rechazada: "Rechazada por SENIAT",
  no_aplica: "SENIAT no aplica",
};

export const rechazoSeniatHistorialItemSchema = z.object({
  motivo: z.string().trim().min(1).max(1000),
  fecha: z.string().trim().max(40),
  usuarioId: z.string().uuid().optional().nullable(),
});

export type RechazoSeniatHistorialItem = z.infer<
  typeof rechazoSeniatHistorialItemSchema
>;

export const importacionSchema = z.object({
  /** FK lógica a public.importadores (cliente del taller). */
  importadorId: z.string().uuid().optional().nullable(),
  regimen: z.string().trim().max(80).optional().nullable(),
  aduana: z.string().trim().max(120).optional().nullable(),
  /** Puerto de llegada / descarga. */
  puerto: z.string().trim().max(120).optional().nullable(),
  /** Tránsito aduanero o USO24. */
  modalidadTransito: z.enum(MODALIDADES_TRANSITO).optional().nullable(),
  /** Aduana de tránsito / destino cuando aplica tránsito o USO24. */
  aduanaTransito: z.string().trim().max(120).optional().nullable(),
  /** Fecha de ingreso al régimen PL / aduana (distinta de la llegada del buque). */
  fechaIngreso: z.string().trim().max(32).optional().nullable(),
  /** Fecha estimada/real de llegada del buque al puerto. */
  fechaLlegadaBuque: z.string().trim().max(32).optional().nullable(),
  numeroBl: z.string().trim().max(80).optional().nullable(),
  paisOrigen: z.string().trim().max(80).optional().nullable(),
  valorCif: z.union([z.number(), z.nan()]).optional().nullable(),
  /** Tasa BCV del día de la declaración (Bs por USD). */
  tasaCambioBcv: z.union([z.number(), z.nan()]).optional().nullable(),
  /** Nº de expediente asignado por SENIAT (distinto del PL interno). */
  numeroExpedienteSeniat: z.string().trim().max(64).optional().nullable(),
  numeroDav: z.string().trim().max(80).optional().nullable(),
  numeroCertificadoOrigen: z.string().trim().max(80).optional().nullable(),
  numeroListaEmpaque: z.string().trim().max(80).optional().nullable(),
  numeroPolizaTransporte: z.string().trim().max(80).optional().nullable(),
  agenteAduanal: z.string().trim().max(120).optional().nullable(),
  observaciones: z.string().trim().max(1000).optional().nullable(),
  estadoNacionalizacion: z.enum(ESTADOS_NACIONALIZACION).optional().nullable(),
  fechaLimiteNacionalizacion: z.string().trim().max(32).optional().nullable(),
  /** Via elegida: cambio_regimen (M2) o permanencia (M3). */
  viaNacionalizacion: z.enum(VIAS_NACIONALIZACION).optional().nullable(),
  /**
   * Paso del wizard de nacionalización:
   * 1 = elegir vía, 2 = docs, 3 = liquidación/resolución, 4 = INTT / cierre.
   */
  nacionalizacionPaso: z.coerce.number().int().min(1).max(4).optional().nullable(),
  estadoSeniat: z.enum(ESTADOS_SENIAT).optional().nullable(),
  fechaPresentacionSeniat: z.string().trim().max(32).optional().nullable(),
  /** Motivo del rechazo SENIAT más reciente. */
  motivoRechazoSeniat: z.string().trim().max(1000).optional().nullable(),
  /** Fecha ISO del rechazo SENIAT más reciente. */
  fechaRechazoSeniat: z.string().trim().max(40).optional().nullable(),
  /** Historial de rechazos (ciclos de corrección). */
  historialRechazosSeniat: z
    .array(rechazoSeniatHistorialItemSchema)
    .max(50)
    .optional()
    .nullable(),
  /** Última alerta email por deadline de nacionalización (ISO). */
  ultimaAlertaDeadlineEnviada: z.string().trim().max(40).optional().nullable(),
  /** Última alerta email por vencimiento de seguro (ISO). */
  ultimaAlertaSeguroEnviada: z.string().trim().max(40).optional().nullable(),
  /** Año del vehículo (modelo). */
  anio: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  /** Condición al registrar: nuevo o usado. */
  condicionVehiculo: z.enum(["nuevo", "usado"]).optional().nullable(),
  /** Si es usado: proviene de subasta. */
  esSubasta: z.boolean().optional().nullable(),
  /** VIN internacional (puede diferir del serial de carrocería). */
  vin: z.string().trim().max(32).optional().nullable(),
  /** Partida / código arancelario. */
  partidaArancelaria: z.string().trim().max(32).optional().nullable(),
  /** Cilindrada del motor en cc. */
  cilindradaCc: z.union([z.number(), z.nan()]).optional().nullable(),
  /** Tipo de combustible del vehículo. */
  tipoCombustible: z
    .enum(["gasolina", "diesel", "electrico", "hibrido", "gnv", "otro"])
    .optional()
    .nullable(),
  importadorNombre: z.string().trim().max(120).optional().nullable(),
  importadorDocumento: z.string().trim().max(40).optional().nullable(),
  importadorTelefono: z.string().trim().max(40).optional().nullable(),
  importadorEmail: z.string().trim().max(120).optional().nullable(),
  /** Dirección fiscal del importador (SENIAT). */
  importadorDireccion: z.string().trim().max(240).optional().nullable(),
  /**
   * 1 = registro (+ factura, certificado origen),
   * 2 = embarque (BL, lista, DAV, póliza),
   * 3 = llegada, 4 = desaduanamiento SENIAT, 5 = propietario, 6 = seguro,
   * 7 = matriculación, 8 = planilla completa.
   */
  planillaFase: z.coerce.number().int().min(1).max(8).optional().nullable(),
  /**
   * Subpaso de fase 7 Matriculación INTT:
   * 1 = carpeta (cargar + físico), 2 = título y placas PL.
   */
  matriculacionPaso: z.coerce.number().int().min(1).max(2).optional().nullable(),
  /** Si el vehículo requiere homologación ante el INTT. */
  requiereHomologacion: z.boolean().optional().nullable(),
  /** Código de expediente PL-Año.Mes.Número (ej. PL-2026.6.3). El correlativo N se deriva parseando este código. */
  codigoExpediente: z.string().trim().max(32).optional().nullable(),
  /**
   * Completitud de datos del vehículo tras carga masiva / OCR:
   * verde = completo, ambar = faltan medios, rojo = faltan marca/modelo (expediente creado igual).
   */
  completitudDatos: z.enum(["rojo", "ambar", "verde"]).optional().nullable(),
  /** Lista corta de campos pendientes (ej. motor, color, nº cert.). */
  datosPendientes: z.array(z.string().trim().max(40)).max(20).optional().nullable(),
  /** Checklist de llegada (fase 2). */
  checklistLlegada: z.record(z.string()).optional().nullable(),
  /** Notas de daño por ítem del checklist de llegada. */
  checklistLlegadaNotas: z.record(z.string()).optional().nullable(),
  /** Notas de otros dispositivos (fase 2). */
  otrosDispositivosNotas: z.string().trim().max(500).optional().nullable(),
  /**
   * Verificación OCR de foto_impronta vs serial_carroceria del expediente:
   * coincide | no_coincide | no_leido.
   */
  serialImprontaEstado: z
    .enum(["coincide", "no_coincide", "no_leido"])
    .optional()
    .nullable(),
  /** Serial leído por OCR en la impronta. */
  serialImprontaLeido: z.string().trim().max(80).optional().nullable(),
  /** ISO timestamp de la última verificación de impronta. */
  serialImprontaVerificadoAt: z.string().trim().max(40).optional().nullable(),
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
    importadorId: row.importadorId ?? row.importador_id,
    regimen: row.regimen ?? row.regimen_importacion,
    aduana: row.aduana,
    puerto: row.puerto,
    modalidadTransito: asOptionalEnum(
      row.modalidadTransito ?? row.modalidad_transito,
      MODALIDADES_TRANSITO
    ),
    aduanaTransito: row.aduanaTransito ?? row.aduana_transito,
    fechaIngreso: row.fechaIngreso ?? row.fecha_ingreso,
    fechaLlegadaBuque: row.fechaLlegadaBuque ?? row.fecha_llegada_buque,
    numeroBl: row.numeroBl ?? row.numero_bl,
    paisOrigen: row.paisOrigen ?? row.pais_origen,
    valorCif:
      typeof row.valorCif === "number"
        ? row.valorCif
        : typeof row.valor_cif === "number"
          ? row.valor_cif
          : row.valorCif ?? row.valor_cif,
    tasaCambioBcv:
      typeof row.tasaCambioBcv === "number"
        ? row.tasaCambioBcv
        : typeof row.tasa_cambio_bcv === "number"
          ? row.tasa_cambio_bcv
          : row.tasaCambioBcv ?? row.tasa_cambio_bcv,
    numeroExpedienteSeniat:
      row.numeroExpedienteSeniat ?? row.numero_expediente_seniat,
    numeroDav: row.numeroDav ?? row.numero_dav,
    numeroCertificadoOrigen:
      row.numeroCertificadoOrigen ?? row.numero_certificado_origen,
    numeroListaEmpaque: row.numeroListaEmpaque ?? row.numero_lista_empaque,
    numeroPolizaTransporte:
      row.numeroPolizaTransporte ?? row.numero_poliza_transporte,
    agenteAduanal: row.agenteAduanal ?? row.agente_aduanal,
    observaciones: row.observaciones,
    estadoNacionalizacion: asOptionalEnum(
      row.estadoNacionalizacion ?? row.estado_nacionalizacion,
      ESTADOS_NACIONALIZACION
    ),
    fechaLimiteNacionalizacion:
      row.fechaLimiteNacionalizacion ?? row.fecha_limite_nacionalizacion,
    viaNacionalizacion: asOptionalEnum(
      row.viaNacionalizacion ?? row.via_nacionalizacion,
      VIAS_NACIONALIZACION
    ),
    nacionalizacionPaso: asOptionalAnio(
      row.nacionalizacionPaso ?? row.nacionalizacion_paso
    ),
    estadoSeniat: asOptionalEnum(
      row.estadoSeniat ?? row.estado_seniat,
      ESTADOS_SENIAT
    ),
    fechaPresentacionSeniat:
      row.fechaPresentacionSeniat ?? row.fecha_presentacion_seniat,
    motivoRechazoSeniat:
      row.motivoRechazoSeniat ?? row.motivo_rechazo_seniat,
    fechaRechazoSeniat: row.fechaRechazoSeniat ?? row.fecha_rechazo_seniat,
    historialRechazosSeniat: (() => {
      const raw =
        row.historialRechazosSeniat ?? row.historial_rechazos_seniat;
      if (!Array.isArray(raw)) return null;
      const items: RechazoSeniatHistorialItem[] = [];
      for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const e = entry as Record<string, unknown>;
        const parsed = rechazoSeniatHistorialItemSchema.safeParse({
          motivo: e.motivo ?? e.reason,
          fecha: e.fecha ?? e.date,
          usuarioId: e.usuarioId ?? e.usuario_id ?? null,
        });
        if (parsed.success) items.push(parsed.data);
      }
      return items.length > 0 ? items : null;
    })(),
    ultimaAlertaDeadlineEnviada:
      row.ultimaAlertaDeadlineEnviada ?? row.ultima_alerta_deadline_enviada,
    ultimaAlertaSeguroEnviada:
      row.ultimaAlertaSeguroEnviada ?? row.ultima_alerta_seguro_enviada,
    anio: asOptionalAnio(row.anio ?? row.anio_vehiculo),
    condicionVehiculo: asOptionalEnum(
      row.condicionVehiculo ?? row.condicion_vehiculo,
      ["nuevo", "usado"] as const
    ),
    esSubasta: (() => {
      const raw = row.esSubasta ?? row.es_subasta;
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === 1 || raw === "1") return true;
      if (raw === "false" || raw === 0 || raw === "0") return false;
      return null;
    })(),
    vin: row.vin,
    partidaArancelaria: row.partidaArancelaria ?? row.partida_arancelaria,
    cilindradaCc:
      typeof row.cilindradaCc === "number"
        ? row.cilindradaCc
        : typeof row.cilindrada_cc === "number"
          ? row.cilindrada_cc
          : row.cilindradaCc ?? row.cilindrada_cc,
    tipoCombustible: asOptionalEnum(
      row.tipoCombustible ?? row.tipo_combustible,
      ["gasolina", "diesel", "electrico", "hibrido", "gnv", "otro"] as const
    ),
    importadorNombre: row.importadorNombre ?? row.importador_nombre,
    importadorDocumento: row.importadorDocumento ?? row.importador_documento,
    importadorTelefono: row.importadorTelefono ?? row.importador_telefono,
    importadorEmail: row.importadorEmail ?? row.importador_email,
    importadorDireccion: row.importadorDireccion ?? row.importador_direccion,
    planillaFase: asOptionalAnio(row.planillaFase ?? row.planilla_fase),
    matriculacionPaso: asOptionalAnio(
      row.matriculacionPaso ?? row.matriculacion_paso
    ),
    requiereHomologacion: asOptionalBool(
      row.requiereHomologacion ?? row.requiere_homologacion
    ),
    codigoExpediente: row.codigoExpediente ?? row.codigo_expediente,
    completitudDatos: asOptionalEnum(
      row.completitudDatos ?? row.completitud_datos,
      ["rojo", "ambar", "verde"] as const
    ),
    datosPendientes: Array.isArray(row.datosPendientes)
      ? (row.datosPendientes as string[]).map(String).slice(0, 20)
      : Array.isArray(row.datos_pendientes)
        ? (row.datos_pendientes as string[]).map(String).slice(0, 20)
        : null,
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
    serialImprontaEstado: asOptionalEnum(
      row.serialImprontaEstado ?? row.serial_impronta_estado,
      ["coincide", "no_coincide", "no_leido"] as const
    ),
    serialImprontaLeido:
      row.serialImprontaLeido ?? row.serial_impronta_leido,
    serialImprontaVerificadoAt:
      row.serialImprontaVerificadoAt ?? row.serial_impronta_verificado_at,
    compradorDireccion: row.compradorDireccion ?? row.comprador_direccion,
  });
  if (!parsed.success) return {};
  return {
    ...parsed.data,
    regimen: resolveRegimenImportacion(parsed.data.regimen),
  };
}

export function serializeImportacion(data: ImportacionData): Record<string, unknown> {
  return {
    importador_id: data.importadorId?.trim() || null,
    regimen: resolveRegimenImportacion(data.regimen),
    aduana: data.aduana?.trim() || null,
    puerto: data.puerto?.trim() || null,
    modalidad_transito: data.modalidadTransito || null,
    aduana_transito:
      data.modalidadTransito === "transito" || data.modalidadTransito === "uso24"
        ? data.aduanaTransito?.trim() || null
        : null,
    fecha_ingreso: data.fechaIngreso?.trim() || null,
    fecha_llegada_buque: data.fechaLlegadaBuque?.trim() || null,
    numero_bl: data.numeroBl?.trim() || null,
    pais_origen: data.paisOrigen?.trim() || null,
    valor_cif:
      data.valorCif != null && !Number.isNaN(data.valorCif) ? data.valorCif : null,
    tasa_cambio_bcv:
      data.tasaCambioBcv != null && !Number.isNaN(data.tasaCambioBcv)
        ? data.tasaCambioBcv
        : null,
    numero_expediente_seniat: data.numeroExpedienteSeniat?.trim() || null,
    numero_dav: data.numeroDav?.trim() || null,
    numero_certificado_origen: data.numeroCertificadoOrigen?.trim() || null,
    numero_lista_empaque: data.numeroListaEmpaque?.trim() || null,
    numero_poliza_transporte: data.numeroPolizaTransporte?.trim() || null,
    agente_aduanal: data.agenteAduanal?.trim() || null,
    observaciones: data.observaciones?.trim() || null,
    estado_nacionalizacion: data.estadoNacionalizacion || null,
    fecha_limite_nacionalizacion: data.fechaLimiteNacionalizacion?.trim() || null,
    via_nacionalizacion: data.viaNacionalizacion || null,
    nacionalizacion_paso:
      data.nacionalizacionPaso != null && !Number.isNaN(data.nacionalizacionPaso)
        ? data.nacionalizacionPaso
        : null,
    estado_seniat: data.estadoSeniat || null,
    fecha_presentacion_seniat: data.fechaPresentacionSeniat?.trim() || null,
    motivo_rechazo_seniat: data.motivoRechazoSeniat?.trim() || null,
    fecha_rechazo_seniat: data.fechaRechazoSeniat?.trim() || null,
    historial_rechazos_seniat:
      data.historialRechazosSeniat && data.historialRechazosSeniat.length > 0
        ? data.historialRechazosSeniat.map((h) => ({
            motivo: h.motivo,
            fecha: h.fecha,
            usuario_id: h.usuarioId ?? null,
          }))
        : null,
    ultima_alerta_deadline_enviada:
      data.ultimaAlertaDeadlineEnviada?.trim() || null,
    ultima_alerta_seguro_enviada:
      data.ultimaAlertaSeguroEnviada?.trim() || null,
    anio: data.anio != null && !Number.isNaN(data.anio) ? data.anio : null,
    condicion_vehiculo: data.condicionVehiculo || null,
    es_subasta:
      data.condicionVehiculo === "usado" && typeof data.esSubasta === "boolean"
        ? data.esSubasta
        : data.condicionVehiculo === "nuevo"
          ? false
          : typeof data.esSubasta === "boolean"
            ? data.esSubasta
            : null,
    vin: data.vin?.trim() || null,
    partida_arancelaria: data.partidaArancelaria?.trim() || null,
    cilindrada_cc:
      data.cilindradaCc != null && !Number.isNaN(data.cilindradaCc)
        ? data.cilindradaCc
        : null,
    tipo_combustible: data.tipoCombustible || null,
    importador_nombre: data.importadorNombre?.trim() || null,
    importador_documento: data.importadorDocumento?.trim() || null,
    importador_telefono: data.importadorTelefono?.trim() || null,
    importador_email: data.importadorEmail?.trim() || null,
    importador_direccion: data.importadorDireccion?.trim() || null,
    planilla_fase:
      data.planillaFase != null && !Number.isNaN(data.planillaFase)
        ? data.planillaFase
        : null,
    matriculacion_paso:
      data.matriculacionPaso != null && !Number.isNaN(data.matriculacionPaso)
        ? data.matriculacionPaso
        : null,
    requiere_homologacion:
      typeof data.requiereHomologacion === "boolean"
        ? data.requiereHomologacion
        : null,
    codigo_expediente: data.codigoExpediente?.trim() || null,
    completitud_datos: data.completitudDatos || null,
    datos_pendientes:
      data.datosPendientes && data.datosPendientes.length > 0
        ? data.datosPendientes.slice(0, 20)
        : null,
    checklist_llegada: data.checklistLlegada ?? null,
    checklist_llegada_notas: data.checklistLlegadaNotas ?? null,
    otros_dispositivos_notas: data.otrosDispositivosNotas?.trim() || null,
    serial_impronta_estado: data.serialImprontaEstado || null,
    serial_impronta_leido: data.serialImprontaLeido?.trim() || null,
    serial_impronta_verificado_at: data.serialImprontaVerificadoAt?.trim() || null,
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

/**
 * Listo para (o en) nacionalización: planilla PL completa y aún no nacionalizado.
 */
export function esProximoNacionalizar(data: ImportacionData): boolean {
  if (!getRegimenConfig(data.regimen).nacionalizacionPuertoLibre) return false;
  const estado = data.estadoNacionalizacion ?? "pendiente";
  if (estado !== "pendiente" && estado !== "en_proceso") return false;
  const fase = data.planillaFase ?? 0;
  return fase >= 8;
}

export function esProximoSeniat(data: ImportacionData): boolean {
  const estado = data.estadoSeniat ?? "pendiente";
  return estado === "pendiente" || estado === "agendada";
}

/** Expediente marcado como rechazado por SENIAT (queda en la misma fase). */
export function esRechazadoSeniat(data: ImportacionData): boolean {
  return (data.estadoSeniat ?? "pendiente") === "rechazada";
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
