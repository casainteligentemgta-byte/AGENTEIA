import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoVisualVista } from "@/lib/schemas/estado-visual-recepcion";
import {
  extensionFromImageMime,
  isGenericMimeType,
  resolveImageMimeType,
  validateImageMimeResolved,
} from "@/lib/mime-image";

export const RECEPCION_ESTADO_VISUAL_BUCKET = "recepcion-estado-visual";

const MAX_BYTES = 10 * 1024 * 1024;

export function validateEstadoVisualFile(file: File): string | null {
  if (isGenericMimeType(file.type)) {
    if (file.size > MAX_BYTES) return "La foto supera 10 MB";
    if (file.size === 0) return "Archivo vacío";
    return null;
  }

  const mime = resolveImageMimeType({
    declaredMime: file.type,
    fileName: file.name,
  });

  const mimeError = validateImageMimeResolved(mime, file.type);
  if (mimeError) return mimeError;

  if (file.size > MAX_BYTES) {
    return "La foto supera 10 MB";
  }
  if (file.size === 0) {
    return "Archivo vacío";
  }
  return null;
}

export type EstadoVisualFotoRef = {
  url: string;
  path: string;
  captured_at: string;
};

export async function uploadEstadoVisualFoto(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    vista: EstadoVisualVista;
    file: File;
    vehiculoId?: string;
  }
): Promise<EstadoVisualFotoRef> {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const mimeType =
    resolveImageMimeType({
      declaredMime: params.file.type,
      fileName: params.file.name,
      buffer,
    }) ?? "image/jpeg";

  return uploadEstadoVisualFotoBuffer(supabase, {
    tallerId: params.tallerId,
    vista: params.vista,
    buffer,
    mimeType: mimeType!,
    vehiculoId: params.vehiculoId,
  });
}

export async function uploadEstadoVisualFotoBuffer(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    vista: EstadoVisualVista;
    buffer: Buffer;
    mimeType: string;
    vehiculoId?: string;
    fileName?: string;
  }
): Promise<EstadoVisualFotoRef> {
  const mimeType =
    resolveImageMimeType({
      declaredMime: params.mimeType,
      fileName: params.fileName,
      buffer: params.buffer,
    }) ?? "image/jpeg";

  if (params.buffer.length > MAX_BYTES) {
    throw new Error("La foto supera 10 MB");
  }
  if (params.buffer.length === 0) {
    throw new Error("Archivo vacío");
  }

  const ext = extensionFromImageMime(mimeType!);
  const folder = params.vehiculoId ?? "temp";
  const path = `${params.tallerId}/${folder}/${params.vista}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(RECEPCION_ESTADO_VISUAL_BUCKET)
    .upload(path, params.buffer, {
      contentType: mimeType!,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data: urlData } = supabase.storage
    .from(RECEPCION_ESTADO_VISUAL_BUCKET)
    .getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    captured_at: new Date().toISOString(),
  };
}
