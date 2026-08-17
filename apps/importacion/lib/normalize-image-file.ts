/** Tipos MIME genéricos que algunos móviles envían en lugar de image/jpeg. */
const GENERIC_IMAGE_MIME = new Set([
  "",
  "application/octet-stream",
  "application/binary",
  "binary/octet-stream",
]);

function fileNameWithJpegExtension(name: string): string {
  const trimmed = name.trim() || "foto";
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(trimmed)) return trimmed;
  return `${trimmed}.jpg`;
}

/**
 * Normaliza el File antes de subirlo vía FormData cuando la cámara
 * reporta application/octet-stream (común en Android/iOS).
 */
export async function normalizeImageFileForUpload(file: File): Promise<File> {
  const type = (file.type || "").trim().toLowerCase();

  if (!GENERIC_IMAGE_MIME.has(type) && type.startsWith("image/")) {
    return file;
  }

  const buffer = await file.arrayBuffer();
  return new File([buffer], fileNameWithJpegExtension(file.name), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}
