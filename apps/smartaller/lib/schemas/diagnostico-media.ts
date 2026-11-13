import { z } from "zod";
import { DIAGNOSTICOS_BUCKET } from "@/lib/storage/buckets";
import { isPublicSupabaseStorageUrl, toAuthorizedFileUrl } from "@/lib/storage/signed-url";

export const DIAGNOSTICO_MEDIA_TYPES = ["image", "video"] as const;
export type DiagnosticoMediaType = (typeof DIAGNOSTICO_MEDIA_TYPES)[number];

export const DiagnosticoMediaItemSchema = z.object({
  url: z.string().min(1),
  path: z.string().min(1),
  type: z.enum(DIAGNOSTICO_MEDIA_TYPES),
  caption: z.string().max(200).optional(),
  created_at: z.string().optional(),
});

export type DiagnosticoMediaItem = z.infer<typeof DiagnosticoMediaItemSchema>;

export const DiagnosticoMediaListSchema = z.array(DiagnosticoMediaItemSchema);

export const MAX_DIAGNOSTICO_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DIAGNOSTICO_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_DIAGNOSTICO_FILES_PER_UPLOAD = 8;

export const DIAGNOSTICO_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const DIAGNOSTICO_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export function mediaTypeFromMime(mime: string): DiagnosticoMediaType | null {
  if (DIAGNOSTICO_IMAGE_MIME.has(mime)) return "image";
  if (DIAGNOSTICO_VIDEO_MIME.has(mime)) return "video";
  return null;
}

export function parseMediaFromDetalle(raw: unknown): DiagnosticoMediaItem[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const media = (raw as { media?: unknown }).media;
  const parsed = DiagnosticoMediaListSchema.safeParse(media);
  if (!parsed.success) return [];
  return parsed.data.map((item) => {
    const url =
      isPublicSupabaseStorageUrl(item.url) || item.url.includes("/storage/v1/object/")
        ? toAuthorizedFileUrl(DIAGNOSTICOS_BUCKET, item.path)
        : item.url;
    return { ...item, url };
  });
}

export function mergeMediaIntoDetalle(
  detalle: Record<string, unknown>,
  items: DiagnosticoMediaItem[]
): Record<string, unknown> {
  const existing = parseMediaFromDetalle(detalle);
  return {
    ...detalle,
    media: [...existing, ...items],
  };
}
