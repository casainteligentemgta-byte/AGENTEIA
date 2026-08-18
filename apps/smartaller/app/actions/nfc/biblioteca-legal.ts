"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canMutateImportacionData } from "@/lib/importacion/access";
import {
  BIBLIOTECA_LEGAL_CATEGORIAS,
  isBibliotecaLegalCategoria,
  type BibliotecaLegalDocumento,
} from "@/lib/importacion/biblioteca-legal-docs";
import { resolvePortalAccess } from "@/lib/portal/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { VEHICULO_DOCS_BUCKET } from "@/lib/vehiculos/upload-documento";

const MAX_BYTES = 10 * 1024 * 1024;

const metaSchema = z.object({
  titulo: z.string().trim().min(1, "Título requerido").max(180),
  categoria: z.enum(BIBLIOTECA_LEGAL_CATEGORIAS),
  descripcion: z.string().trim().max(500).optional().nullable(),
  organismo: z.string().trim().max(120).optional().nullable(),
  anio: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  normaId: z.string().trim().max(80).optional().nullable(),
});

type ActionOk<T> = { success: true } & T;
type ActionErr = { success: false; error: string };

type DocRow = {
  id: string;
  created_at: string;
  categoria: string;
  titulo: string;
  descripcion: string | null;
  organismo: string | null;
  anio: number | null;
  norma_id: string | null;
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number | null;
};

function mapTableMissing(error: { message: string; code?: string }): string | null {
  if (
    error.code === "42P01" ||
    /biblioteca_legal_documentos.*does not exist/i.test(error.message)
  ) {
    return "Falta la tabla biblioteca_legal_documentos. Ejecuta la migración en Supabase SQL Editor.";
  }
  return null;
}

function mapRow(row: DocRow): BibliotecaLegalDocumento {
  const categoria = isBibliotecaLegalCategoria(row.categoria)
    ? row.categoria
    : "otro";
  return {
    id: row.id,
    categoria,
    titulo: row.titulo,
    descripcion: row.descripcion,
    organismo: row.organismo,
    anio: row.anio,
    normaId: row.norma_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileUrl: row.file_url,
    fileSize: row.file_size,
    createdAt: row.created_at,
  };
}

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) {
    return { error: "Debes iniciar sesión" as const, taller: null, user: null };
  }
  const taller = await getMyTaller();
  if (!taller) {
    return {
      error: "No se encontró tu taller" as const,
      taller: null,
      user: null,
    };
  }
  return { error: null, taller, user };
}

function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name);
}

export async function listBibliotecaLegalDocumentosAction(): Promise<
  ActionOk<{ documentos: BibliotecaLegalDocumento[]; canUpload: boolean }> | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const access = await resolvePortalAccess();
  const canUpload = access ? canMutateImportacionData(access) : true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("biblioteca_legal_documentos")
    .select(
      "id, created_at, categoria, titulo, descripcion, organismo, anio, norma_id, file_name, file_path, file_url, file_size"
    )
    .eq("taller_id", auth.taller.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: mapTableMissing(error) ?? error.message };
  }

  return {
    success: true,
    documentos: (data as DocRow[] | null)?.map(mapRow) ?? [],
    canUpload,
  };
}

export async function uploadBibliotecaLegalPdfAction(
  formData: FormData
): Promise<ActionOk<{ documento: BibliotecaLegalDocumento }> | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller || !auth.user) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const access = await resolvePortalAccess();
  if (access && !canMutateImportacionData(access)) {
    return { success: false, error: "No tienes permiso para subir documentos" };
  }

  const parsed = metaSchema.safeParse({
    titulo: String(formData.get("titulo") ?? ""),
    categoria: String(formData.get("categoria") ?? ""),
    descripcion: String(formData.get("descripcion") ?? "") || null,
    organismo: String(formData.get("organismo") ?? "") || null,
    anio: String(formData.get("anio") ?? "").trim() || null,
    normaId: String(formData.get("normaId") ?? "") || null,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Selecciona un PDF" };
  }
  if (!isPdfFile(file)) {
    return { success: false, error: "Solo se admiten archivos PDF" };
  }
  if (file.size === 0) return { success: false, error: "Archivo vacío" };
  if (file.size > MAX_BYTES) {
    return { success: false, error: "El archivo supera 10 MB" };
  }

  const id = crypto.randomUUID();
  const fileName = file.name.toLowerCase().endsWith(".pdf")
    ? file.name
    : `${file.name}.pdf`;
  const filePath = `${auth.taller.id}/biblioteca-legal/${id}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(VEHICULO_DOCS_BUCKET)
    .upload(filePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  const { data: urlData } = admin.storage
    .from(VEHICULO_DOCS_BUCKET)
    .getPublicUrl(filePath);

  const { data, error } = await admin
    .from("biblioteca_legal_documentos")
    .insert({
      id,
      taller_id: auth.taller.id,
      uploaded_by: auth.user.id,
      categoria: parsed.data.categoria,
      titulo: parsed.data.titulo,
      descripcion: parsed.data.descripcion || null,
      organismo: parsed.data.organismo || null,
      anio: parsed.data.anio ?? null,
      norma_id: parsed.data.normaId || null,
      file_name: fileName,
      file_path: filePath,
      file_url: urlData.publicUrl,
      file_size: file.size,
    })
    .select(
      "id, created_at, categoria, titulo, descripcion, organismo, anio, norma_id, file_name, file_path, file_url, file_size"
    )
    .single();

  if (error) {
    await admin.storage.from(VEHICULO_DOCS_BUCKET).remove([filePath]);
    return { success: false, error: mapTableMissing(error) ?? error.message };
  }

  revalidatePath("/smartimport/biblioteca-legal");
  return { success: true, documento: mapRow(data as DocRow) };
}

export async function deleteBibliotecaLegalDocumentoAction(
  documentoId: string
): Promise<{ success: true } | ActionErr> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const access = await resolvePortalAccess();
  if (access && !canMutateImportacionData(access)) {
    return { success: false, error: "No tienes permiso para eliminar documentos" };
  }

  const idParsed = z.string().uuid().safeParse(documentoId);
  if (!idParsed.success) {
    return { success: false, error: "Documento inválido" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("biblioteca_legal_documentos")
    .select("id, file_path")
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id)
    .maybeSingle();

  if (error) {
    return { success: false, error: mapTableMissing(error) ?? error.message };
  }
  if (!data) return { success: false, error: "Documento no encontrado" };

  const path = (data as { file_path: string }).file_path;
  await admin.storage.from(VEHICULO_DOCS_BUCKET).remove([path]);

  const { error: delError } = await admin
    .from("biblioteca_legal_documentos")
    .delete()
    .eq("id", idParsed.data)
    .eq("taller_id", auth.taller.id);

  if (delError) {
    return { success: false, error: mapTableMissing(delError) ?? delError.message };
  }

  revalidatePath("/smartimport/biblioteca-legal");
  return { success: true };
}
