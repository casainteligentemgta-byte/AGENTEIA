import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentoTipo, VehiculoDocumentoRef } from "@/lib/schemas/vehiculo-documentos";
import {
  isGenericMimeType,
  resolveImageMimeType,
  validateImageMimeResolved,
} from "@/lib/mime-image";
import { imageBufferToPdf, pdfFileNameFromOriginal } from "@/lib/vehiculos/image-to-pdf";

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

/**
 * Sube documento al storage del vehículo.
 * - PDF: se guarda tal cual
 * - Foto (JPG/PNG): se convierte a PDF de una página y se guarda (por defecto)
 */
export async function uploadVehiculoDocumento(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    vehiculoId: string | "temp";
    tipo: DocumentoTipo;
    file: File;
    /** Por defecto true: fotos → PDF. */
    convertImagesToPdf?: boolean;
  }
): Promise<VehiculoDocumentoRef> {
  const validationError = validateVehiculoDocumentoFile(params.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const convertToPdf = params.convertImagesToPdf !== false;
  const originalBuffer = Buffer.from(await params.file.arrayBuffer());
  const folder = params.vehiculoId === "temp" ? "temp" : params.vehiculoId;
  const id = crypto.randomUUID();

  let uploadBuffer: Buffer;
  let contentType: string;
  let fileName: string;
  let path: string;

  if (params.file.type === "application/pdf") {
    uploadBuffer = originalBuffer;
    contentType = "application/pdf";
    fileName = params.file.name?.toLowerCase().endsWith(".pdf")
      ? params.file.name
      : pdfFileNameFromOriginal(params.file.name, params.tipo);
    path = `${params.tallerId}/${folder}/${params.tipo}-${id}.pdf`;
  } else {
    const mimeType =
      resolveImageMimeType({
        declaredMime: params.file.type,
        fileName: params.file.name,
        buffer: originalBuffer,
      }) ?? "image/jpeg";

    const canEmbedInPdf = mimeType === "image/jpeg" || mimeType === "image/png";

    if (convertToPdf && canEmbedInPdf) {
      try {
        uploadBuffer = await imageBufferToPdf(originalBuffer, mimeType);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo convertir la foto a PDF";
        throw new Error(msg);
      }
      contentType = "application/pdf";
      fileName = pdfFileNameFromOriginal(params.file.name, params.tipo);
      path = `${params.tallerId}/${folder}/${params.tipo}-${id}.pdf`;
    } else {
      // HEIC/WebP (u otros): guardar imagen tal cual para no fallar en móvil
      uploadBuffer = originalBuffer;
      contentType = mimeType;
      const ext =
        mimeType === "image/png"
          ? "png"
          : mimeType === "image/webp"
            ? "webp"
            : mimeType === "image/heic" || mimeType === "image/heif"
              ? "heic"
              : "jpg";
      fileName = params.file.name || `${params.tipo}.${ext}`;
      path = `${params.tallerId}/${folder}/${params.tipo}-${id}.${ext}`;
    }
  }

  const { error } = await supabase.storage.from(VEHICULO_DOCS_BUCKET).upload(path, uploadBuffer, {
    contentType,
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
    file_name: fileName,
  };
}
