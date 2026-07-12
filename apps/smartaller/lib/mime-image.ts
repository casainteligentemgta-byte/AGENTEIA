export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

export const IMAGE_MIME_SET = new Set<string>(IMAGE_MIME_TYPES);

const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/binary",
  "binary/octet-stream",
]);

const EXTENSION_TO_MIME: Record<string, ImageMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jpe: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const MIME_TO_EXTENSION: Record<ImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function normalizeDeclaredMime(mime: string | undefined | null): string {
  const value = (mime ?? "").trim().toLowerCase();
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  return value;
}

function mimeFromFileName(fileName: string | undefined): ImageMimeType | null {
  if (!fileName) return null;
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_TO_MIME[ext] ?? null;
}

function mimeFromMagicBytes(buffer: Buffer): ImageMimeType | null {
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("hevc")) {
      return "image/heic";
    }
    if (brand.startsWith("heif") || brand.startsWith("mif1") || brand.startsWith("msf1")) {
      return "image/heif";
    }
  }

  return null;
}

export function isGenericMimeType(mime: string | undefined | null): boolean {
  return GENERIC_MIME_TYPES.has(normalizeDeclaredMime(mime));
}

export function extensionFromImageMime(mime: string): string {
  return MIME_TO_EXTENSION[mime as ImageMimeType] ?? "jpg";
}

/**
 * Resuelve el MIME de una imagen cuando el cliente reporta application/octet-stream
 * o deja el tipo vacío (común en cámara móvil / algunos navegadores).
 */
export function resolveImageMimeType(params: {
  declaredMime?: string | null;
  fileName?: string;
  buffer?: Buffer;
}): ImageMimeType | null {
  const declared = normalizeDeclaredMime(params.declaredMime);

  if (IMAGE_MIME_SET.has(declared)) {
    return declared as ImageMimeType;
  }

  const fromName = mimeFromFileName(params.fileName);
  if (fromName && isGenericMimeType(declared)) {
    return fromName;
  }

  if (params.buffer) {
    const fromBytes = mimeFromMagicBytes(params.buffer);
    if (fromBytes) return fromBytes;
  }

  if (fromName) return fromName;

  return null;
}

export function validateImageMimeResolved(
  mime: ImageMimeType | null,
  declaredMime?: string | null
): string | null {
  if (mime) return null;
  const declared = normalizeDeclaredMime(declaredMime);
  return `Formato no permitido: ${declared || "desconocido"}. Usa JPG, PNG o WEBP.`;
}
