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
