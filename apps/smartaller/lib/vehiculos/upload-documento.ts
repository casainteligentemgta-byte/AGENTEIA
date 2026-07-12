import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehiculoDocumentoRef } from "@/lib/schemas/vehiculo-documentos";
import {
  extensionFromImageMime,
  isGenericMimeType,
  resolveImageMimeType,
  validateImageMimeResolved,
} from "@/lib/mime-image";

export const VEHICULO_DOCS_BUCKET = "vehiculos-documentos";

const MAX_BYTES = 10 * 1024 * 1024;

export function validateVehiculoDocumentoFile(file: File): string | null {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) return "El archivo supera 10 MB";
    if (file.size === 0) return "Archivo vacío";
    return null;
  }

  if (isGenericMimeType(file.type)) {
    if (file.size > MAX_BYTES) return "El archivo supera 10 MB";
    if (file.size === 0) return "Archivo vacío";
    return null;
  }

  const mime = resolveImageMimeType({
    declaredMime: file.type,
    fileName: file.name,
  });
  const mimeError = validateImageMimeResolved(mime, file.type);
  if (mimeError) return mimeError;

  if (file.size > MAX_BYTES) return "El archivo supera 10 MB";
  if (file.size === 0) return "Archivo vacío";
  return null;
}

export async function uploadVehiculoDocumento(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    vehiculoId: string | "temp";
    tipo: "cedula" | "titulo";
    file: File;
  }
): Promise<VehiculoDocumentoRef> {
  const validationError = validateVehiculoDocumentoFile(params.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const mimeType =
    params.file.type === "application/pdf"
      ? "application/pdf"
      : resolveImageMimeType({
          declaredMime: params.file.type,
          fileName: params.file.name,
          buffer,
        }) ?? "image/jpeg";

  const ext =
    mimeType === "application/pdf" ? "pdf" : extensionFromImageMime(mimeType);
  const folder = params.vehiculoId === "temp" ? "temp" : params.vehiculoId;
  const path = `${params.tallerId}/${folder}/${params.tipo}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(VEHICULO_DOCS_BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: urlData } = supabase.storage.from(VEHICULO_DOCS_BUCKET).getPublicUrl(path);

  return {
    url: urlData.publicUrl,
    path,
    scanned_at: new Date().toISOString(),
  };
}
