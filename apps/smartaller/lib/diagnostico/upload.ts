import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DiagnosticoMediaItem,
  MAX_DIAGNOSTICO_IMAGE_BYTES,
  MAX_DIAGNOSTICO_VIDEO_BYTES,
  mediaTypeFromMime,
} from "@/lib/schemas/diagnostico-media";

const BUCKET = "diagnosticos";

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[mime] ?? "bin";
}

export function validateDiagnosticoFile(file: File): string | null {
  const mediaType = mediaTypeFromMime(file.type);
  if (!mediaType) {
    return `Formato no permitido: ${file.type || "desconocido"}`;
  }
  const max =
    mediaType === "image" ? MAX_DIAGNOSTICO_IMAGE_BYTES : MAX_DIAGNOSTICO_VIDEO_BYTES;
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return `${file.name}: máximo ${mb} MB`;
  }
  if (file.size === 0) {
    return `${file.name}: archivo vacío`;
  }
  return null;
}

export async function uploadDiagnosticoFiles(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    mantenimientoId: string;
    files: File[];
  }
): Promise<{ items: DiagnosticoMediaItem[]; errors: string[] }> {
  const items: DiagnosticoMediaItem[] = [];
  const errors: string[] = [];

  for (const file of params.files) {
    const validationError = validateDiagnosticoFile(file);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    const mediaType = mediaTypeFromMime(file.type)!;
    const ext = extensionFromMime(file.type);
    const path = `${params.tallerId}/${params.mantenimientoId}/${crypto.randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      errors.push(`${file.name}: ${uploadError.message}`);
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    items.push({
      url: urlData.publicUrl,
      path,
      type: mediaType,
      created_at: new Date().toISOString(),
    });
  }

  return { items, errors };
}

export { BUCKET as DIAGNOSTICO_STORAGE_BUCKET };
