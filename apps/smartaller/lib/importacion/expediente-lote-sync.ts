import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseImportacion,
  parseVehiculosDocumentos,
  serializeImportacion,
  type DocumentoTipo,
  type ImportacionData,
  type VehiculoDocumentoRef,
} from "@/lib/schemas/vehiculo-documentos";
import {
  DOCUMENTO_TIPOS_CARGA_BL,
  DOCUMENTO_TIPOS_LOTE,
  documentosConCopiaLote,
  fillEmptyImportacionLote,
  isDocumentoLote,
  isSiblingDelMismoLote,
  mergeImportacionLote,
  nextPlanillaFaseLote,
  normalizeLoteBlKey,
  pickDocumentosLoteFaltantes,
  pickImportacionLoteFields,
} from "@/lib/importacion/expediente-lote";
import { parseImportadorDocumentos } from "@/lib/importadores/upload-documento";
import { mergeCedulaRifDesdeCliente } from "@/lib/importacion/docs-importador-expediente";

type SiblingRow = {
  id: string;
  importacion: unknown;
  documentos: unknown;
};

async function loadPosiblesHermanos(
  admin: SupabaseClient,
  tallerId: string,
  sourceVehiculoId: string
): Promise<SiblingRow[]> {
  const { data, error } = await admin
    .from("vehiculos")
    .select("id, importacion, documentos")
    .eq("taller_id", tallerId)
    .neq("id", sourceVehiculoId);
  if (error || !data) return [];
  return data as SiblingRow[];
}

function hermanosDelLote(
  rows: SiblingRow[],
  source: ImportacionData
): SiblingRow[] {
  if (!normalizeLoteBlKey(source.numeroBl)) return [];
  return rows.filter((row) =>
    isSiblingDelMismoLote(source, parseImportacion(row.importacion))
  );
}

export async function syncLoteDocumentoToSiblings(params: {
  admin: SupabaseClient;
  tallerId: string;
  sourceVehiculoId: string;
  sourceImportacion: ImportacionData;
  tipo: DocumentoTipo;
  documento: VehiculoDocumentoRef;
}): Promise<number> {
  if (!isDocumentoLote(params.tipo)) return 0;
  const rows = hermanosDelLote(
    await loadPosiblesHermanos(
      params.admin,
      params.tallerId,
      params.sourceVehiculoId
    ),
    params.sourceImportacion
  );
  if (rows.length === 0) return 0;
  const results = await Promise.all(
    rows.map(async (row) => {
      const next = documentosConCopiaLote(
        parseVehiculosDocumentos(row.documentos),
        params.tipo,
        params.documento
      );
      const { error } = await params.admin
        .from("vehiculos")
        .update({ documentos: next, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("taller_id", params.tallerId);
      return !error;
    })
  );
  return results.filter(Boolean).length;
}

/**
 * Copia al BL todos los papeles de carga ya subidos en el expediente fuente.
 */
export async function syncCargaBlDocumentosToSiblings(params: {
  admin: SupabaseClient;
  tallerId: string;
  sourceVehiculoId: string;
  sourceImportacion: ImportacionData;
}): Promise<{ archivos: number; expedientes: number }> {
  const { data: source } = await params.admin
    .from("vehiculos")
    .select("documentos")
    .eq("id", params.sourceVehiculoId)
    .eq("taller_id", params.tallerId)
    .maybeSingle();
  if (!source) return { archivos: 0, expedientes: 0 };

  const sourceDocs = parseVehiculosDocumentos(source.documentos);
  const tipos = DOCUMENTO_TIPOS_CARGA_BL.filter((tipo) =>
    Boolean(sourceDocs[tipo]?.url)
  );
  if (tipos.length === 0) return { archivos: 0, expedientes: 0 };

  const rows = hermanosDelLote(
    await loadPosiblesHermanos(
      params.admin,
      params.tallerId,
      params.sourceVehiculoId
    ),
    params.sourceImportacion
  );
  let expedientes = 0;
  for (const row of rows) {
    let next = parseVehiculosDocumentos(row.documentos);
    for (const tipo of tipos) {
      next = documentosConCopiaLote(next, tipo, sourceDocs[tipo]!);
    }
    const { error } = await params.admin
      .from("vehiculos")
      .update({ documentos: next, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("taller_id", params.tallerId);
    if (!error) expedientes += 1;
  }
  return { archivos: tipos.length, expedientes };
}

/** Copia refs de documentos (mismo path de Storage) a IDs concretos. Sin OCR. */
export async function copyDocumentosToVehiculoIds(params: {
  admin: SupabaseClient;
  tallerId: string;
  sourceVehiculoId: string;
  targetVehiculoIds: readonly string[];
  tipos: readonly DocumentoTipo[];
}): Promise<number> {
  const targets = [...new Set(params.targetVehiculoIds)].filter(
    (id) => id && id !== params.sourceVehiculoId
  );
  if (targets.length === 0 || params.tipos.length === 0) return 0;

  const { data: source, error: sourceError } = await params.admin
    .from("vehiculos")
    .select("id, documentos")
    .eq("id", params.sourceVehiculoId)
    .eq("taller_id", params.tallerId)
    .maybeSingle();
  if (sourceError || !source) return 0;

  const sourceDocs = parseVehiculosDocumentos(source.documentos);
  const toCopy = params.tipos
    .map((tipo) => {
      const ref = sourceDocs[tipo];
      return ref ? ([tipo, ref] as const) : null;
    })
    .filter((x): x is readonly [DocumentoTipo, VehiculoDocumentoRef] =>
      Boolean(x)
    );
  if (toCopy.length === 0) return 0;

  const { data: rows, error } = await params.admin
    .from("vehiculos")
    .select("id, documentos")
    .eq("taller_id", params.tallerId)
    .in("id", targets);
  if (error || !rows?.length) return 0;

  let copied = 0;
  await Promise.all(
    rows.map(async (row) => {
      let next = parseVehiculosDocumentos(row.documentos);
      for (const [tipo, ref] of toCopy) {
        next = documentosConCopiaLote(next, tipo, ref);
      }
      const { error: updError } = await params.admin
        .from("vehiculos")
        .update({ documentos: next, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("taller_id", params.tallerId);
      if (!updError) copied += 1;
    })
  );
  return copied;
}

export async function syncLoteImportacionToSiblings(params: {
  admin: SupabaseClient;
  tallerId: string;
  sourceVehiculoId: string;
  lookup: ImportacionData;
  lote: ImportacionData;
}): Promise<number> {
  const lookup = normalizeLoteBlKey(params.lookup.numeroBl)
    ? params.lookup
    : params.lote;
  const rows = hermanosDelLote(
    await loadPosiblesHermanos(
      params.admin,
      params.tallerId,
      params.sourceVehiculoId
    ),
    lookup
  );
  let copied = 0;
  for (const row of rows) {
    const existing = parseImportacion(row.importacion);
    const merged = serializeImportacion(
      mergeImportacionLote(existing, params.lote)
    );
    const { error } = await params.admin
      .from("vehiculos")
      .update({ importacion: merged, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("taller_id", params.tallerId);
    if (!error) copied += 1;
  }
  return copied;
}

/**
 * Si el expediente ya tiene BL, hereda docs y huecos de lote de un hermano.
 * No cambia planillaFase ni pisa factura/certificado ya cargados.
 */
export async function inheritLoteOntoVehiculo(params: {
  admin: SupabaseClient;
  tallerId: string;
  targetVehiculoId: string;
}): Promise<{ inheritedDocs: number; inheritedFields: boolean }> {
  const { data: target, error } = await params.admin
    .from("vehiculos")
    .select("id, importacion, documentos")
    .eq("id", params.targetVehiculoId)
    .eq("taller_id", params.tallerId)
    .maybeSingle();
  if (error || !target) return { inheritedDocs: 0, inheritedFields: false };

  const targetImp = parseImportacion(target.importacion);
  if (!normalizeLoteBlKey(targetImp.numeroBl)) {
    return { inheritedDocs: 0, inheritedFields: false };
  }

  const siblings = hermanosDelLote(
    await loadPosiblesHermanos(
      params.admin,
      params.tallerId,
      params.targetVehiculoId
    ),
    targetImp
  );
  if (siblings.length === 0) {
    return { inheritedDocs: 0, inheritedFields: false };
  }

  let best = siblings[0]!;
  let bestCount = -1;
  for (const row of siblings) {
    const docs = parseVehiculosDocumentos(row.documentos);
    const count = DOCUMENTO_TIPOS_LOTE.filter((tipo) =>
      Boolean(docs[tipo]?.url)
    ).length;
    if (count > bestCount) {
      best = row;
      bestCount = count;
    }
  }

  const sourceDocs = parseVehiculosDocumentos(best.documentos);
  const sourceImp = parseImportacion(best.importacion);
  const currentDocs = parseVehiculosDocumentos(target.documentos);
  const nextDocs = pickDocumentosLoteFaltantes(currentDocs, sourceDocs);
  const nextImp = fillEmptyImportacionLote(targetImp, sourceImp);

  const inheritedDocs = DOCUMENTO_TIPOS_LOTE.filter(
    (tipo) => !currentDocs[tipo]?.url && Boolean(nextDocs[tipo]?.url)
  ).length;
  const inheritedFields =
    JSON.stringify(pickImportacionLoteFields(nextImp)) !==
    JSON.stringify(pickImportacionLoteFields(targetImp));

  if (inheritedDocs === 0 && !inheritedFields) {
    return { inheritedDocs: 0, inheritedFields: false };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (inheritedDocs > 0) patch.documentos = nextDocs;
  if (inheritedFields) patch.importacion = serializeImportacion(nextImp);

  const { error: updError } = await params.admin
    .from("vehiculos")
    .update(patch)
    .eq("id", params.targetVehiculoId)
    .eq("taller_id", params.tallerId);
  if (updError) return { inheritedDocs: 0, inheritedFields: false };
  return { inheritedDocs, inheritedFields };
}

export async function loadImportadorDocumentos(params: {
  admin: SupabaseClient;
  tallerId: string;
  importadorId: string | null | undefined;
}): Promise<ReturnType<typeof parseImportadorDocumentos>> {
  const id = params.importadorId?.trim();
  if (!id) return {};
  const { data } = await params.admin
    .from("importadores")
    .select("documentos")
    .eq("id", id)
    .eq("taller_id", params.tallerId)
    .maybeSingle();
  return parseImportadorDocumentos(data?.documentos);
}

/**
 * Copia cédula y RIF del cliente a los expedientes que aún no los tienen.
 * Devuelve los documentos del primer id (ya fusionados).
 */
export async function copyCedulaRifClienteOntoVehiculos(params: {
  admin: SupabaseClient;
  tallerId: string;
  importadorId: string | null | undefined;
  rows: { id: string; documentos: unknown }[];
}): Promise<Map<string, ReturnType<typeof parseVehiculosDocumentos>>> {
  const out = new Map<string, ReturnType<typeof parseVehiculosDocumentos>>();
  const cliente = await loadImportadorDocumentos(params);
  for (const row of params.rows) {
    const current = parseVehiculosDocumentos(row.documentos);
    const { next, added } = mergeCedulaRifDesdeCliente(current, cliente);
    out.set(row.id, next);
    if (added.length === 0) continue;
    await params.admin
      .from("vehiculos")
      .update({ documentos: next, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("taller_id", params.tallerId);
  }
  return out;
}

/**
 * Avanza fase 2→3 y 3→4 en el expediente fuente y hermanos del BL
 * según papeles y fechas de la carga. No toca registro ni 4+.
 */
export async function advanceLotePlanillaFases(params: {
  admin: SupabaseClient;
  tallerId: string;
  sourceVehiculoId: string;
  sourceImportacion: ImportacionData;
}): Promise<number> {
  const { data: sourceRow } = await params.admin
    .from("vehiculos")
    .select("id, importacion, documentos")
    .eq("id", params.sourceVehiculoId)
    .eq("taller_id", params.tallerId)
    .maybeSingle();
  if (!sourceRow) return 0;

  const hermanos = hermanosDelLote(
    await loadPosiblesHermanos(
      params.admin,
      params.tallerId,
      params.sourceVehiculoId
    ),
    params.sourceImportacion
  );
  const rows = [sourceRow as SiblingRow, ...hermanos];
  let advanced = 0;
  for (const row of rows) {
    const imp = parseImportacion(row.importacion);
    const docs = parseVehiculosDocumentos(row.documentos);
    const nextFase = nextPlanillaFaseLote({
      faseActual: imp.planillaFase,
      docs,
      fechaLlegadaBuque: imp.fechaLlegadaBuque,
      fechaIngreso: imp.fechaIngreso,
    });
    const actual = imp.planillaFase ?? 1;
    if (nextFase <= actual) continue;
    const { error } = await params.admin
      .from("vehiculos")
      .update({
        importacion: serializeImportacion({ ...imp, planillaFase: nextFase }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("taller_id", params.tallerId);
    if (!error) advanced += 1;
  }
  return advanced;
}
