import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoVisualVista } from "@/lib/schemas/estado-visual-recepcion";

export const RECEPCION_ESTADO_VISUAL_BUCKET = "recepcion-estado-visual";

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extensionFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return map[mime] ?? "jpg";
}

export function validateEstadoVisualFile(file: File): string | null {
  if (!ALLOWED_MIME.has(file.type)) {
    return `Formato no permitido: ${file.type || "desconocido"}`;
  }
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
  const validationError = validateEstadoVisualFile(params.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const ext = extensionFromMime(params.file.type);
  const folder = params.vehiculoId ?? "temp";
  const path = `${params.tallerId}/${folder}/${params.vista}-${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const { error } = await supabase.storage
    .from(RECEPCION_ESTADO_VISUAL_BUCKET)
    .upload(path, buffer, {
      contentType: params.file.type,
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
