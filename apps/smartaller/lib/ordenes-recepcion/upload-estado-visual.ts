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

  const buffer = Buffer.from(await params.file.arrayBuffer());
  return uploadEstadoVisualFotoBuffer(supabase, {
    ...params,
    buffer,
    mimeType: params.file.type,
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
  }
): Promise<EstadoVisualFotoRef> {
  if (!ALLOWED_MIME.has(params.mimeType)) {
    throw new Error(`Formato no permitido: ${params.mimeType || "desconocido"}`);
  }
  if (params.buffer.length > MAX_BYTES) {
    throw new Error("La foto supera 10 MB");
  }
  if (params.buffer.length === 0) {
    throw new Error("Archivo vacío");
  }

  const ext = extensionFromMime(params.mimeType);
  const folder = params.vehiculoId ?? "temp";
  const path = `${params.tallerId}/${folder}/${params.vista}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(RECEPCION_ESTADO_VISUAL_BUCKET)
    .upload(path, params.buffer, {
      contentType: params.mimeType,
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
