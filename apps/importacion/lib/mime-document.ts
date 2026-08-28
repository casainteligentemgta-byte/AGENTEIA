import { resolveImageMimeType } from "@/lib/mime-image";

function declaredMimeOf(raw: string | null | undefined): string {
  return (raw ?? "").split(";")[0].trim().toLowerCase();
}

export function isPdfMagic(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF";
}

/** PDF real: magic bytes ganan al Content-Type (iOS manda application/json). */
export function isPdfDocument(buffer: Buffer, mimeType?: string | null): boolean {
  if (isPdfMagic(buffer)) return true;
  if (isJsonOrHtmlPayload(buffer)) return false;
  return (mimeType ?? "").toLowerCase().includes("pdf");
}

/** Cuerpos de error de Storage / HTML en lugar del PDF o la foto. */
export function isJsonOrHtmlPayload(buffer: Buffer): boolean {
  const head = buffer
    .toString("utf8", 0, Math.min(buffer.length, 96))
    .trimStart()
    .toLowerCase();
  return (
    head.startsWith("{") ||
    head.startsWith("[") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html")
  );
}

/**
 * MIME real del documento. No confiar en Content-Type de Storage
 * (a menudo llega application/json en el Blob).
 */
export function sniffDocumentMime(params: {
  buffer: Buffer;
  declaredMime?: string | null;
  fileName?: string;
}): string {
  const declared = declaredMimeOf(params.declaredMime);
  const fileName = params.fileName ?? "";
  const looksPdf =
    isPdfMagic(params.buffer) ||
    declared === "application/pdf" ||
    /\.pdf$/i.test(fileName);

  if (looksPdf) {
    if (!isPdfMagic(params.buffer) && isJsonOrHtmlPayload(params.buffer)) {
      throw new Error(
        "No se pudo leer el PDF desde Storage (llegó JSON). Vuelve a subir la factura y toca Procesar."
      );
    }
    return "application/pdf";
  }

  const image = resolveImageMimeType({
    declaredMime: declared === "application/json" ? "" : declared,
    fileName,
    buffer: params.buffer,
  });
  if (image) return image;

  if (isJsonOrHtmlPayload(params.buffer)) {
    throw new Error(
      "No se pudo leer el documento desde Storage (llegó JSON). Vuelve a subir y toca Procesar."
    );
  }

  return "application/pdf";
}
