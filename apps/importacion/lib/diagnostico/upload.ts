import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type DiagnosticoMediaItem,
  MAX_DIAGNOSTICO_IMAGE_BYTES,
  MAX_DIAGNOSTICO_VIDEO_BYTES,
} from "@/lib/schemas/diagnostico-media";
import {
  extensionFromImageMime,
  isGenericMimeType,
  resolveImageMimeType,
  validateImageMimeResolved,
} from "@/lib/mime-image";

const BUCKET = "diagnosticos";

const VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function extensionFromVideoMime(mime: string): string {
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[mime] ?? "mp4";
}

export function validateDiagnosticoFile(file: File): string | null {
  if (VIDEO_MIME.has(file.type)) {
    if (file.size > MAX_DIAGNOSTICO_VIDEO_BYTES) {
      const mb = Math.round(MAX_DIAGNOSTICO_VIDEO_BYTES / (1024 * 1024));
      return `${file.name}: máximo ${mb} MB`;
    }
    if (file.size === 0) return `${file.name}: archivo vacío`;
    return null;
  }

  if (isGenericMimeType(file.type)) {
    if (file.size > MAX_DIAGNOSTICO_IMAGE_BYTES) {
      const mb = Math.round(MAX_DIAGNOSTICO_IMAGE_BYTES / (1024 * 1024));
      return `${file.name}: máximo ${mb} MB`;
    }
    if (file.size === 0) return `${file.name}: archivo vacío`;
    return null;
  }

  const mime = resolveImageMimeType({
    declaredMime: file.type,
    fileName: file.name,
  });
  const mimeError = validateImageMimeResolved(mime, file.type);
  if (mimeError) return mimeError;

  if (file.size > MAX_DIAGNOSTICO_IMAGE_BYTES) {
    const mb = Math.round(MAX_DIAGNOSTICO_IMAGE_BYTES / (1024 * 1024));
    return `${file.name}: máximo ${mb} MB`;
  }
  if (file.size === 0) return `${file.name}: archivo vacío`;
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const isVideo = VIDEO_MIME.has(file.type);
    const mimeType = isVideo
      ? file.type
      : resolveImageMimeType({
          declaredMime: file.type,
          fileName: file.name,
          buffer,
        }) ?? "image/jpeg";
    const mediaType = isVideo ? "video" : "image";
    const ext = isVideo ? extensionFromVideoMime(mimeType) : extensionFromImageMime(mimeType);
    const path = `${params.tallerId}/${params.mantenimientoId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: mimeType,
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
