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
  documentosConCopiaLote,
  isDocumentoLote,
  isSiblingDelMismoLote,
  mergeImportacionLote,
  normalizeLoteBlKey,
} from "@/lib/importacion/expediente-lote";

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
  let copied = 0;
  for (const row of rows) {
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
    if (!error) copied += 1;
  }
  return copied;
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
