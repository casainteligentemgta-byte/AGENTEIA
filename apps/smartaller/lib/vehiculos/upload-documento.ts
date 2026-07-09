import type { SupabaseClient } from "@supabase/supabase-js";
import type { VehiculoDocumentoRef } from "@/lib/schemas/vehiculo-documentos";

export const VEHICULO_DOCS_BUCKET = "vehiculos-documentos";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

export function validateVehiculoDocumentoFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return `Formato no permitido: ${file.type || "desconocido"}`;
  }
  if (file.size > MAX_BYTES) {
    return "El archivo supera 10 MB";
  }
  if (file.size === 0) {
    return "Archivo vacío";
  }
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

  const ext = extensionFromMime(params.file.type);
  const folder = params.vehiculoId === "temp" ? "temp" : params.vehiculoId;
  const path = `${params.tallerId}/${folder}/${params.tipo}-${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const { error } = await supabase.storage.from(VEHICULO_DOCS_BUCKET).upload(path, buffer, {
    contentType: params.file.type,
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
