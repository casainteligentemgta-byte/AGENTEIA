import type {
  DocumentoTipo,
  ImportacionData,
  VehiculoDocumentoRef,
  VehiculosDocumentos,
} from "@/lib/schemas/vehiculo-documentos";

/** Documentos del embarque/lote: se copian a cada expediente del mismo BL. */
export const DOCUMENTO_TIPOS_LOTE: readonly DocumentoTipo[] = [
  "factura_comercial",
  "bl_guia",
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
  "documento_importacion",
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
  "constancia_residencia_permanencia",
  "franquicia_diplomatica",
  "facilidad_diplomatica",
  "autorizacion_admision_temporal",
  "pago_tasas",
  "declaracion_complementaria",
  "liquidacion_nacionalizacion",
  "resolucion_liberacion_seniat",
];

const LOTE_DOC_SET = new Set<DocumentoTipo>(DOCUMENTO_TIPOS_LOTE);

/** Campos de importación compartidos por el BL (no CIF, contenedor ni observaciones). */
export const IMPORTACION_CAMPOS_LOTE = [
  "regimen",
  "aduana",
  "puerto",
  "modalidadTransito",
  "aduanaTransito",
  "fechaIngreso",
  "fechaLlegadaBuque",
  "numeroBl",
  "paisOrigen",
  "tasaCambioBcv",
  "numeroExpedienteSeniat",
  "numeroDav",
  "numeroListaEmpaque",
  "numeroPolizaTransporte",
  "agenteAduanal",
  "estadoNacionalizacion",
  "fechaLimiteNacionalizacion",
  "estadoSeniat",
  "fechaPresentacionSeniat",
] as const satisfies ReadonlyArray<keyof ImportacionData>;

export type ImportacionCampoLote = (typeof IMPORTACION_CAMPOS_LOTE)[number];

export function isDocumentoLote(tipo: DocumentoTipo): boolean {
  return LOTE_DOC_SET.has(tipo);
}

export function normalizeLoteBlKey(
  value: string | null | undefined
): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

export function sameLoteBl(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizeLoteBlKey(a);
  const right = normalizeLoteBlKey(b);
  return Boolean(left) && left === right;
}

export function sameLoteImportador(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left || !right) return true;
  return left === right;
}

export function isSiblingDelMismoLote(
  source: Pick<ImportacionData, "numeroBl" | "importadorId">,
  candidate: Pick<ImportacionData, "numeroBl" | "importadorId">
): boolean {
  return (
    sameLoteBl(source.numeroBl, candidate.numeroBl) &&
    sameLoteImportador(source.importadorId, candidate.importadorId)
  );
}

export function pickImportacionLoteFields(
  data: Partial<ImportacionData>
): Partial<ImportacionData> {
  const next: Partial<ImportacionData> = {};
  for (const key of IMPORTACION_CAMPOS_LOTE) {
    if (data[key] !== undefined) {
      (next as Record<string, unknown>)[key] = data[key];
    }
  }
  return next;
}

/** Aplica datos de lote al expediente hermano; no pisa CIF, contenedor ni fase. */
export function mergeImportacionLote(
  existing: ImportacionData,
  lote: Partial<ImportacionData>
): ImportacionData {
  const patch = pickImportacionLoteFields(lote);
  return { ...existing, ...patch };
}

export function documentosConCopiaLote(
  current: VehiculosDocumentos,
  tipo: DocumentoTipo,
  ref: VehiculoDocumentoRef
): VehiculosDocumentos {
  return { ...current, [tipo]: ref };
}

/**
 * Docs de toda la carga (un PDF por BL). No incluye factura ni certificado.
 * Póliza = transporte de la carga, no el seguro del vehículo.
 * Partida, fotos y cuestionario siguen por expediente.
 */
export const DOCUMENTO_TIPOS_CARGA_BL_EMBARQUE: readonly DocumentoTipo[] = [
  "bl_guia",
  "lista_empaque",
  "poliza_transporte",
  "acta_recepcion_mercancia",
  "constancia_edi_reconocimiento",
];

export const DOCUMENTO_TIPOS_CARGA_BL_DESADUANA: readonly DocumentoTipo[] = [
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

export const DOCUMENTO_TIPOS_CARGA_BL: readonly DocumentoTipo[] = [
  ...DOCUMENTO_TIPOS_CARGA_BL_EMBARQUE,
  ...DOCUMENTO_TIPOS_CARGA_BL_DESADUANA,
];

export function cargaBlPath(
  numeroBl: string | null | undefined,
  fromVehiculoId?: string | null
): string {
  const key = normalizeLoteBlKey(numeroBl);
  if (key) return `/smartimport/lote?bl=${encodeURIComponent(key)}`;
  const from = (fromVehiculoId ?? "").trim();
  if (from) return `/smartimport/lote?from=${encodeURIComponent(from)}`;
  return "/smartimport/lote";
}

export function isImportacionCampoLoteVacio(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/** Rellena huecos de lote; no pisa valores ya escritos ni la fase. */
export function fillEmptyImportacionLote(
  existing: ImportacionData,
  lote: Partial<ImportacionData>
): ImportacionData {
  const patch = pickImportacionLoteFields(lote);
  const next: ImportacionData = { ...existing };
  for (const key of IMPORTACION_CAMPOS_LOTE) {
    const incoming = patch[key];
    if (incoming === undefined || isImportacionCampoLoteVacio(incoming)) {
      continue;
    }
    if (isImportacionCampoLoteVacio(next[key])) {
      (next as Record<string, unknown>)[key] = incoming;
    }
  }
  return next;
}

/** Copia refs de lote que el destino aún no tiene. */
export function pickDocumentosLoteFaltantes(
  current: VehiculosDocumentos,
  source: VehiculosDocumentos
): VehiculosDocumentos {
  const next: VehiculosDocumentos = { ...current };
  for (const tipo of DOCUMENTO_TIPOS_LOTE) {
    if (next[tipo]?.url) continue;
    const ref = source[tipo];
    if (ref?.url) next[tipo] = ref;
  }
  return next;
}

export function countDocumentosCargaBl(docs: VehiculosDocumentos): number {
  let n = 0;
  for (const tipo of DOCUMENTO_TIPOS_CARGA_BL) {
    if (docs[tipo]?.url) n += 1;
  }
  return n;
}

export type CargaBlGroup<T extends { numeroBl?: string | null }> = {
  blKey: string;
  label: string;
  items: T[];
};

export function groupByCargaBl<T extends { numeroBl?: string | null }>(
  items: T[]
): CargaBlGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = normalizeLoteBlKey(item.numeroBl);
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }
  return order.map((blKey) => ({
    blKey,
    label: blKey || "Sin BL",
    items: map.get(blKey)!,
  }));
}
