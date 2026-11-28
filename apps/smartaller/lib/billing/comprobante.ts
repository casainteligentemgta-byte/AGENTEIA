import { isPdfDocument } from "@/lib/mime-document";
import {
  isGenericMimeType,
  resolveImageMimeType,
  validateImageMimeResolved,
} from "@/lib/mime-image";
import { COMPROBANTES_PAGO_BUCKET } from "@/lib/storage/buckets";

export { COMPROBANTES_PAGO_BUCKET };
export const COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function validateComprobantePagoFile(file: File): string | null {
  if (file.size <= 0) return "Archivo vacío";
  if (file.size > COMPROBANTE_MAX_BYTES) return "El comprobante no puede superar 10 MB";

  const declared = (file.type || "").split(";")[0].trim().toLowerCase();
  if (declared === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return null;
  }
  if (isGenericMimeType(file.type)) return null;

  const mime = resolveImageMimeType({
    declaredMime: file.type,
    fileName: file.name,
  });
  const mimeError = validateImageMimeResolved(mime, file.type);
  if (mimeError) return "Adjunta una imagen (JPG, PNG, WebP) o un PDF";
  return null;
}

export function resolveComprobanteMime(
  file: File,
  buffer: Buffer
): { mime: string; ext: string } | { error: string } {
  if (isPdfDocument(buffer, file.type) || /\.pdf$/i.test(file.name)) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  const mime =
    resolveImageMimeType({
      declaredMime: file.type,
      fileName: file.name,
      buffer,
    }) ?? null;
  if (!mime || !ALLOWED_IMAGE.has(mime)) {
    return { error: "Adjunta una imagen (JPG, PNG, WebP) o un PDF" };
  }
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/heic"
          ? "heic"
          : mime === "image/heif"
            ? "heif"
            : "jpg";
  return { mime, ext };
}

export function comprobanteStoragePath(userId: string, ext: string): string {
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}
