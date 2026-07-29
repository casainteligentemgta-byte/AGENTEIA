import { PDFDocument } from "pdf-lib";

const A4_WIDTH = 595;
const A4_HEIGHT = 842;

/**
 * Convierte una imagen (JPEG/PNG) en un PDF de una página (ajustado a A4).
 * WebP/HEIC deben normalizarse a JPEG en el cliente antes de subir.
 */
export async function imageBufferToPdf(
  imageBytes: Buffer | Uint8Array,
  mimeType: string
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const bytes = imageBytes instanceof Buffer ? new Uint8Array(imageBytes) : imageBytes;

  let image;
  if (mimeType === "image/png") {
    image = await pdf.embedPng(bytes);
  } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    image = await pdf.embedJpg(bytes);
  } else {
    throw new Error(
      "Para convertir a PDF usa foto JPG o PNG (o sube un PDF directamente)."
    );
  }

  const scale = Math.min(A4_WIDTH / image.width, A4_HEIGHT / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  page.drawImage(image, {
    x: (A4_WIDTH - width) / 2,
    y: (A4_HEIGHT - height) / 2,
    width,
    height,
  });

  return Buffer.from(await pdf.save());
}

export function pdfFileNameFromOriginal(originalName: string | undefined, tipo: string): string {
  const base = (originalName || tipo)
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/gi, "")
    .trim()
    .slice(0, 60);
  return `${base || tipo}.pdf`;
}
