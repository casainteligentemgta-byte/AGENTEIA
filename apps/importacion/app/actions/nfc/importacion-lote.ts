"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import {
  parseImportacion,
  parseVehiculosDocumentos,
  serializeImportacion,
  type DocumentoTipo,
  type VehiculoDocumentoRef,
} from "@/lib/schemas/vehiculo-documentos";
import {
  DOCUMENTO_TIPOS_CARGA_BL,
  countDocumentosCargaBl,
  groupByCargaBl,
  mergeDocumentosCargaBl,
  normalizeLoteBlKey,
  sameLoteBl,
} from "@/lib/importacion/expediente-lote";
import {
  inheritLoteOntoVehiculo,
  syncLoteImportacionToSiblings,
  copyCedulaRifClienteOntoVehiculos,
  syncCargaBlDocumentosToSiblings,
  advanceLotePlanillaFases,
} from "@/lib/importacion/expediente-lote-sync";
import {
  placaRealVisible,
  resolveCodigoExpediente,
} from "@/lib/importacion/expediente";

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

function revalidateLote(vehiculoId?: string) {
  revalidatePath("/smartimport");
  revalidatePath("/smartimport/lote");
  if (vehiculoId) {
    revalidatePath(`/smartimport/${vehiculoId}`);
    revalidatePath(`/smartimport/${vehiculoId}/planilla`);
  }
}

export type CargaBlUnidad = {
  id: string;
  codigoExpediente: string;
  vin: string | null;
  marca: string | null;
  modelo: string | null;
};

export type CargaBlLote = {
  numeroBl: string;
  sourceVehiculoId: string;
  fechaIngreso: string;
  fechaLlegadaBuque: string;
  puerto: string;
  aduana: string;
  agenteAduanal: string;
  importadorNombre: string;
  documentos: Partial<Record<DocumentoTipo, VehiculoDocumentoRef>>;
  docsCargados: number;
  docsTotal: number;
  unidades: CargaBlUnidad[];
};

export type CargaBlIndexItem = {
  blKey: string;
  label: string;
  unidades: number;
  docsCargados: number;
  fechaIngreso: string | null;
};

function unidadFromRow(row: {
  id: string;
  placa?: unknown;
  serial_carroceria?: unknown;
  marca?: unknown;
  modelo?: unknown;
  importacion?: unknown;
}): CargaBlUnidad {
  const imp = parseImportacion(row.importacion);
  const placa = String(row.placa ?? "");
  const codigo =
    resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa,
    }) ?? placaRealVisible(placa, imp.codigoExpediente) ?? placa;
  return {
    id: row.id,
    codigoExpediente: codigo || "Expediente",
    vin: (row.serial_carroceria as string | null) ?? imp.vin ?? null,
    marca: (row.marca as string | null) ?? null,
    modelo: (row.modelo as string | null) ?? null,
  };
}

export async function getCargaBlLoteAction(
  numeroBl: string
): Promise<
  { success: true; lote: CargaBlLote } | { success: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const blKey = normalizeLoteBlKey(numeroBl);
  if (!blKey) return { success: false, error: "Indica el nº de BL" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select("id, placa, serial_carroceria, marca, modelo, importacion, documentos")
    .eq("taller_id", auth.taller.id);
  if (error) return { success: false, error: error.message };

  const rows = (data ?? []).filter((row) =>
    sameLoteBl(blKey, parseImportacion(row.importacion).numeroBl)
  );
  if (rows.length === 0) {
    return { success: false, error: "No hay expedientes con ese BL" };
  }

  let best = rows[0]!;
  let bestCount = -1;
  for (const row of rows) {
    const count = countDocumentosCargaBl(parseVehiculosDocumentos(row.documentos));
    if (count > bestCount) {
      best = row;
      bestCount = count;
    }
  }

  const importadorId =
    parseImportacion(best.importacion).importadorId ??
    rows
      .map((row) => parseImportacion(row.importacion).importadorId)
      .find((id) => Boolean(id?.trim())) ??
    null;
  const hydrated = await copyCedulaRifClienteOntoVehiculos({
    admin,
    tallerId: auth.taller.id,
    importadorId,
    rows: rows.map((row) => ({
      id: row.id as string,
      documentos: row.documentos,
    })),
  });
  const docsList = rows.map((row) => {
    const id = row.id as string;
    return hydrated.get(id) ?? parseVehiculosDocumentos(row.documentos);
  });
  const docs = mergeDocumentosCargaBl(docsList);
  const documentos: CargaBlLote["documentos"] = {};
  for (const tipo of DOCUMENTO_TIPOS_CARGA_BL) {
    const ref = docs[tipo];
    if (ref) documentos[tipo] = ref;
  }
  const imp = parseImportacion(best.importacion);

  return {
    success: true,
    lote: {
      numeroBl: imp.numeroBl?.trim() || blKey,
      sourceVehiculoId: best.id as string,
      fechaIngreso: imp.fechaIngreso?.trim() || "",
      fechaLlegadaBuque: imp.fechaLlegadaBuque?.trim() || "",
      puerto: imp.puerto?.trim() || "",
      aduana: imp.aduana?.trim() || "",
      agenteAduanal: imp.agenteAduanal?.trim() || "",
      importadorNombre: imp.importadorNombre?.trim() || "",
      documentos,
      docsCargados: countDocumentosCargaBl(docs),
      docsTotal: DOCUMENTO_TIPOS_CARGA_BL.length,
      unidades: rows.map((row) => unidadFromRow(row as typeof best)),
    },
  };
}

export async function listCargaBlIndexAction(): Promise<
  { success: true; lotes: CargaBlIndexItem[] } | { success: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select("id, importacion, documentos")
    .eq("taller_id", auth.taller.id);
  if (error) return { success: false, error: error.message };

  const items = (data ?? []).map((row) => {
    const imp = parseImportacion(row.importacion);
    return {
      id: row.id as string,
      numeroBl: imp.numeroBl ?? null,
      fechaIngreso: imp.fechaIngreso?.trim() || null,
      docsCargados: countDocumentosCargaBl(parseVehiculosDocumentos(row.documentos)),
    };
  });

  const lotes = groupByCargaBl(items)
    .filter((g) => g.blKey)
    .map((g) => ({
      blKey: g.blKey,
      label: g.label,
      unidades: g.items.length,
      docsCargados: Math.max(...g.items.map((i) => i.docsCargados), 0),
      fechaIngreso: g.items.find((i) => i.fechaIngreso)?.fechaIngreso ?? null,
    }));

  return { success: true, lotes };
}

const fechaSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .or(z.literal(""));

const cargaBlDatosSchema = z.object({
  sourceVehiculoId: z.string().uuid(),
  numeroBl: z.string().trim().max(80).optional(),
  fechaIngreso: fechaSchema,
  fechaLlegadaBuque: fechaSchema,
  puerto: z.string().trim().max(120),
  aduana: z.string().trim().max(120),
  agenteAduanal: z.string().trim().max(120),
});

function numeroBlGuardado(
  raw: string | undefined,
  fallback: string | null | undefined
): string {
  const next = (raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (next) return next;
  return (fallback ?? "").trim();
}

export async function saveCargaBlDatosAction(input: {
  sourceVehiculoId: string;
  numeroBl?: string;
  fechaIngreso: string;
  fechaLlegadaBuque: string;
  puerto: string;
  aduana: string;
  agenteAduanal: string;
}): Promise<
  | {
      success: true;
      loteCopiados: number;
      fasesAvanzadas: number;
      numeroBl: string;
    }
  | { success: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const parsed = cargaBlDatosSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("vehiculos")
    .select("id, importacion")
    .eq("id", parsed.data.sourceVehiculoId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  if (error || !row) return { success: false, error: "Expediente no encontrado" };

  const existing = parseImportacion(row.importacion);
  if (!normalizeLoteBlKey(existing.numeroBl)) {
    return { success: false, error: "Este expediente no tiene nº de BL" };
  }

  const nextBl = numeroBlGuardado(parsed.data.numeroBl, existing.numeroBl);
  if (!normalizeLoteBlKey(nextBl)) {
    return { success: false, error: "Indica el nº de BL / guía" };
  }

  const merged = {
    ...existing,
    numeroBl: nextBl,
    fechaIngreso: parsed.data.fechaIngreso || null,
    fechaLlegadaBuque: parsed.data.fechaLlegadaBuque || null,
    puerto: parsed.data.puerto || null,
    aduana: parsed.data.aduana || null,
    agenteAduanal: parsed.data.agenteAduanal || null,
  };
  const { error: updError } = await admin
    .from("vehiculos")
    .update({
      importacion: serializeImportacion(merged),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.sourceVehiculoId)
    .eq("taller_id", auth.taller.id);
  if (updError) return { success: false, error: updError.message };

  const loteCopiados = await syncLoteImportacionToSiblings({
    admin,
    tallerId: auth.taller.id,
    sourceVehiculoId: parsed.data.sourceVehiculoId,
    lookup: existing,
    lote: merged,
  });
  const fasesAvanzadas = await advanceLotePlanillaFases({
    admin,
    tallerId: auth.taller.id,
    sourceVehiculoId: parsed.data.sourceVehiculoId,
    sourceImportacion: merged,
  });
  revalidateLote(parsed.data.sourceVehiculoId);
  return { success: true, loteCopiados, fasesAvanzadas, numeroBl: nextBl };
}

export async function saveCargaBlLoteCompletoAction(input: {
  sourceVehiculoId: string;
  numeroBl?: string;
  fechaIngreso: string;
  fechaLlegadaBuque: string;
  puerto: string;
  aduana: string;
  agenteAduanal: string;
}): Promise<
  | {
      success: true;
      loteCopiados: number;
      archivos: number;
      fasesAvanzadas: number;
      numeroBl: string;
    }
  | { success: false; error: string }
> {
  const datos = await saveCargaBlDatosAction(input);
  if (!datos.success) return datos;

  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("vehiculos")
    .select("importacion")
    .eq("id", input.sourceVehiculoId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  const sourceImportacion = parseImportacion(row?.importacion);
  const sync = await syncCargaBlDocumentosToSiblings({
    admin,
    tallerId: auth.taller.id,
    sourceVehiculoId: input.sourceVehiculoId,
    sourceImportacion,
  });
  const fasesAvanzadas = await advanceLotePlanillaFases({
    admin,
    tallerId: auth.taller.id,
    sourceVehiculoId: input.sourceVehiculoId,
    sourceImportacion,
  });
  revalidateLote(input.sourceVehiculoId);
  return {
    success: true,
    loteCopiados: Math.max(datos.loteCopiados, sync.expedientes),
    archivos: sync.archivos,
    fasesAvanzadas: Math.max(datos.fasesAvanzadas, fasesAvanzadas),
    numeroBl: datos.numeroBl,
  };
}

/** @deprecated Usar saveCargaBlDatosAction. */
export async function saveCargaBlFechaIngresoAction(input: {
  sourceVehiculoId: string;
  fechaIngreso: string;
}): Promise<
  | { success: true; loteCopiados: number }
  | { success: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const idParsed = z.string().uuid().safeParse(input.sourceVehiculoId);
  if (!idParsed.success) return { success: false, error: "Expediente inválido" };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("vehiculos")
    .select("importacion")
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  const existing = parseImportacion(row?.importacion);
  return saveCargaBlDatosAction({
    sourceVehiculoId: idParsed.data,
    fechaIngreso: input.fechaIngreso,
    fechaLlegadaBuque: existing.fechaLlegadaBuque ?? "",
    puerto: existing.puerto ?? "",
    aduana: existing.aduana ?? "",
    agenteAduanal: existing.agenteAduanal ?? "",
  });
}

export async function assignNumeroBlAction(input: {
  vehiculoId: string;
  numeroBl: string;
}): Promise<
  | { success: true; numeroBl: string; inheritedDocs: number }
  | { success: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }
  const idParsed = z.string().uuid().safeParse(input.vehiculoId);
  const bl = normalizeLoteBlKey(input.numeroBl);
  if (!idParsed.success) return { success: false, error: "Expediente inválido" };
  if (!bl) return { success: false, error: "Indica el nº de BL / guía" };
  if (bl.length > 80) return { success: false, error: "El nº de BL es demasiado largo" };

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("vehiculos")
    .select("id, importacion")
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();
  if (error || !row) return { success: false, error: "Expediente no encontrado" };

  const existing = parseImportacion(row.importacion);
  const merged = {
    ...existing,
    numeroBl: input.numeroBl.trim().toUpperCase().replace(/\s+/g, " "),
  };
  const { error: updError } = await admin
    .from("vehiculos")
    .update({
      importacion: serializeImportacion(merged),
      updated_at: new Date().toISOString(),
    })
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id);
  if (updError) return { success: false, error: updError.message };

  const inherited = await inheritLoteOntoVehiculo({
    admin,
    tallerId: auth.taller.id,
    targetVehiculoId: idParsed.data,
  });
  revalidateLote(idParsed.data);
  return { success: true, numeroBl: bl, inheritedDocs: inherited.inheritedDocs };
}
