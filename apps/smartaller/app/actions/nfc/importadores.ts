"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  IMPORTADOR_SELECT,
  IMPORTADOR_TIPO_LABELS,
  displayNombreImportador,
  importadorEnsureSchema,
  importadorUpsertSchema,
  importadorUpsertToDbPayload,
  type ImportadorRow,
  type ImportadorTipo,
} from "@/lib/schemas/importador";
import {
  parseImportadorDocumentos,
  uploadImportadorDocumento,
  validateImportadorDocumentoFile,
  type ImportadorDocumentos,
  type ImportadorDocTipo,
} from "@/lib/importadores/upload-documento";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";

export type ImportadorListItem = {
  id: string;
  tipo: ImportadorTipo;
  tipoLabel: string;
  nombre: string;
  documento: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  instagram: string | null;
  denominacionComercial: string | null;
  razonSocial: string | null;
  repLegalNombre: string | null;
  repLegalCedula: string | null;
  repLegalEmail: string | null;
  repLegalTelefono: string | null;
  empresaTelefono: string | null;
  empresaEmail: string | null;
  empresaDomicilio: string | null;
  registroPuertoLibre: string | null;
  registroPlVence: string | null;
  documentos: ImportadorDocumentos;
  activo: boolean;
  createdAt: string;
};

type ActionOk<T> = { success: true } & T;
type ActionErr = { success: false; error: string };

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) return { error: "Debes iniciar sesión" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

function mapRow(row: ImportadorRow): ImportadorListItem {
  return {
    id: row.id,
    tipo: row.tipo,
    tipoLabel: IMPORTADOR_TIPO_LABELS[row.tipo],
    nombre: displayNombreImportador(row),
    documento: row.documento,
    cedula: row.cedula,
    telefono: row.telefono,
    email: row.email,
    direccion: row.direccion,
    instagram: row.instagram,
    denominacionComercial: row.denominacion_comercial,
    razonSocial: row.razon_social,
    repLegalNombre: row.rep_legal_nombre,
    repLegalCedula: row.rep_legal_cedula,
    repLegalEmail: row.rep_legal_email,
    repLegalTelefono: row.rep_legal_telefono,
    empresaTelefono: row.empresa_telefono,
    empresaEmail: row.empresa_email,
    empresaDomicilio: row.empresa_domicilio,
    registroPuertoLibre: row.registro_puerto_libre,
    registroPlVence: row.registro_pl_vence,
    documentos: parseImportadorDocumentos(row.documentos),
    activo: row.activo,
    createdAt: row.created_at,
  };
}

export async function listImportadoresAction(params?: {
  q?: string;
  soloActivos?: boolean;
}): Promise<ActionOk<{ importadores: ImportadorListItem[] }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const admin = createAdminClient();
  let query = admin
    .from("importadores")
    .select(IMPORTADOR_SELECT)
    .eq("taller_id", auth.taller.id)
    .order("nombre", { ascending: true })
    .limit(300);

  if (params?.soloActivos !== false) {
    query = query.eq("activo", true);
  }

  const q = params?.q?.trim();
  if (q) {
    query = query.or(
      [
        `nombre.ilike.%${q}%`,
        `documento.ilike.%${q}%`,
        `cedula.ilike.%${q}%`,
        `telefono.ilike.%${q}%`,
        `denominacion_comercial.ilike.%${q}%`,
        `razon_social.ilike.%${q}%`,
        `rep_legal_nombre.ilike.%${q}%`,
        `registro_puerto_libre.ilike.%${q}%`,
      ].join(",")
    );
  }

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  return {
    success: true,
    importadores: (data as ImportadorRow[] | null)?.map(mapRow) ?? [],
  };
}

export async function getImportadorAction(
  importadorId: string
): Promise<ActionOk<{ importador: ImportadorListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const idParsed = z.string().uuid().safeParse(importadorId);
  if (!idParsed.success) return { success: false, error: "ID inválido" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("importadores")
    .select(IMPORTADOR_SELECT)
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Cliente no encontrado" };

  return { success: true, importador: mapRow(data as ImportadorRow) };
}

export async function upsertImportadorAction(
  raw: unknown
): Promise<ActionOk<{ importador: ImportadorListItem }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = importadorUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const data = parsed.data;
  const admin = createAdminClient();
  const payload = importadorUpsertToDbPayload(data, auth.taller.id);

  if (data.id) {
    const { data: updated, error } = await admin
      .from("importadores")
      .update(payload)
      .eq("id", data.id)
      .eq("taller_id", auth.taller.id)
      .select(IMPORTADOR_SELECT)
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "Ya existe un cliente con ese RIF en tu taller",
        };
      }
      return { success: false, error: error.message };
    }
    if (!updated) return { success: false, error: "Cliente no encontrado" };

    revalidatePath("/smartimport/clientes");
    revalidatePath("/smartimport/importaciones/nueva");
    return { success: true, importador: mapRow(updated as ImportadorRow) };
  }

  const { data: created, error } = await admin
    .from("importadores")
    .insert(payload)
    .select(IMPORTADOR_SELECT)
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      return {
        success: false,
        error: "Ya existe un cliente con ese RIF en tu taller",
      };
    }
    return { success: false, error: error?.message ?? "No se pudo guardar" };
  }

  revalidatePath("/smartimport/clientes");
  revalidatePath("/smartimport/importaciones/nueva");
  return { success: true, importador: mapRow(created as ImportadorRow) };
}

/**
 * Busca por documento o crea importador (carga masiva).
 * Auth de taller obligatoria; `tallerId` debe coincidir con el taller de la sesión.
 */
export async function ensureImportadorForTaller(params: {
  tallerId: string;
  nombre: string;
  documento: string;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  tipo?: ImportadorTipo;
  cedula?: string | null;
}): Promise<
  | { ok: true; importadorId: string }
  | { ok: false; error: string }
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  if (auth.taller.id !== params.tallerId) {
    return { ok: false, error: "Taller no autorizado" };
  }

  const parsed = importadorEnsureSchema.safeParse({
    tipo: params.tipo,
    nombre: params.nombre,
    documento: params.documento,
    telefono: params.telefono ?? "",
    email: params.email ?? "",
    direccion: params.direccion ?? "",
    cedula: params.cedula ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Cliente inválido",
    };
  }

  const tallerId = auth.taller.id;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("importadores")
    .select("id")
    .eq("taller_id", tallerId)
    .eq("documento", parsed.data.documento)
    .maybeSingle();

  if (existing?.id) {
    return { ok: true, importadorId: existing.id as string };
  }

  const insertPayload: Record<string, unknown> =
    parsed.data.tipo === "natural"
      ? {
          taller_id: tallerId,
          tipo: "natural",
          nombre: parsed.data.nombre,
          documento: parsed.data.documento,
          cedula: parsed.data.cedula || null,
          telefono: parsed.data.telefono?.trim() || null,
          email: parsed.data.email?.trim() || null,
          direccion: parsed.data.direccion?.trim() || null,
          activo: true,
          updated_at: new Date().toISOString(),
        }
      : {
          taller_id: tallerId,
          tipo: "juridica",
          nombre: parsed.data.nombre,
          documento: parsed.data.documento,
          razon_social: parsed.data.nombre,
          denominacion_comercial: parsed.data.nombre,
          telefono: parsed.data.telefono?.trim() || null,
          email: parsed.data.email?.trim() || null,
          direccion: parsed.data.direccion?.trim() || null,
          empresa_telefono: parsed.data.telefono?.trim() || null,
          empresa_email: parsed.data.email?.trim() || null,
          empresa_domicilio: parsed.data.direccion?.trim() || null,
          // Placeholder: completar en ficha de clientes (obligatorio en UI).
          registro_puerto_libre: "PENDIENTE",
          registro_pl_vence: "2099-12-31",
          rep_legal_nombre: "Por completar",
          rep_legal_cedula: parsed.data.cedula || "V-00000000",
          cedula: parsed.data.cedula || "V-00000000",
          activo: true,
          updated_at: new Date().toISOString(),
        };

  const { data: created, error } = await admin
    .from("importadores")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !created) {
    if (error?.code === "23505") {
      const { data: again } = await admin
        .from("importadores")
        .select("id")
        .eq("taller_id", tallerId)
        .eq("documento", parsed.data.documento)
        .maybeSingle();
      if (again?.id) return { ok: true, importadorId: again.id as string };
    }
    return { ok: false, error: error?.message ?? "No se pudo crear el cliente" };
  }

  return { ok: true, importadorId: created.id as string };
}

export async function setImportadorActivoAction(raw: unknown): Promise<
  ActionOk<{ importador: ImportadorListItem }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      importadorId: z.string().uuid(),
      activo: z.boolean(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Datos inválidos" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("importadores")
    .update({
      activo: parsed.data.activo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.importadorId)
    .eq("taller_id", auth.taller.id)
    .select(IMPORTADOR_SELECT)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Cliente no encontrado" };

  revalidatePath("/smartimport/clientes");
  return { success: true, importador: mapRow(data as ImportadorRow) };
}

/** Elimina un cliente importador del taller. */
export async function deleteImportadorAction(raw: unknown): Promise<
  ActionOk<{ importadorId: string }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = z
    .object({
      importadorId: z.string().uuid(),
    })
    .safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Cliente inválido" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("importadores")
    .delete()
    .eq("id", parsed.data.importadorId)
    .eq("taller_id", auth.taller.id)
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Cliente no encontrado" };

  revalidatePath("/smartimport/clientes");
  revalidatePath("/smartimport/importaciones/nueva");
  revalidatePath("/smartimport/carga-masiva");
  return { success: true, importadorId: data.id as string };
}

/** Sube RIF o cédula al cliente y lo guarda en importadores.documentos. */
export async function attachImportadorDocumentoAction(
  formData: FormData
): Promise<
  | ActionOk<{ documentos: ImportadorDocumentos; tipoDoc: ImportadorDocTipo }>
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const importadorId = String(formData.get("importadorId") ?? "").trim();
  const tipoDoc = String(formData.get("tipoDoc") ?? "").trim();
  const file = formData.get("file");

  if (!z.string().uuid().safeParse(importadorId).success) {
    return { success: false, error: "Cliente inválido" };
  }
  if (tipoDoc !== "rif" && tipoDoc !== "cedula") {
    return { success: false, error: "Tipo de documento inválido" };
  }
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona una foto o un PDF" };
  }

  const validationError = validateImportadorDocumentoFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from("importadores")
    .select("id, documentos")
    .eq("id", importadorId)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!row) return { success: false, error: "Cliente no encontrado" };

  try {
    const documento = await uploadImportadorDocumento(admin, {
      tallerId: auth.taller.id,
      importadorId,
      tipo: tipoDoc,
      file,
    });

    const current = parseImportadorDocumentos(row.documentos);
    const next: ImportadorDocumentos = {
      ...current,
      [tipoDoc]: documento,
    };

    const { error: updateError } = await admin
      .from("importadores")
      .update({
        documentos: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importadorId)
      .eq("taller_id", auth.taller.id);

    if (updateError) {
      return {
        success: false,
        error: `Archivo subido pero no se guardó en el cliente: ${updateError.message}`,
      };
    }

    revalidatePath("/smartimport/clientes");
    revalidatePath("/smartimport/importaciones/nueva");
    return { success: true, documentos: next, tipoDoc };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo subir el documento",
    };
  }
}
