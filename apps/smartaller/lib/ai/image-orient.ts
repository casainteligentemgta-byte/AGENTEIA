/**
 * Rotación / recorte de imágenes para OCR (fotos de hoja anexa / factura).
 * Usa @napi-rs/canvas en runtime Node.
 */

export type RotationDegrees = 90 | 180 | 270;

export async function rotateImageBuffer(
  buffer: Buffer,
  degrees: RotationDegrees
): Promise<{ buffer: Buffer; mimeType: "image/png" }> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(buffer);
  const swap = degrees === 90 || degrees === 270;
  const canvas = createCanvas(swap ? img.height : img.width, swap ? img.width : img.height);
  const ctx = canvas.getContext("2d");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return { buffer: canvas.toBuffer("image/png"), mimeType: "image/png" };
}

/**
 * Recorta una fracción de la imagen (ratios 0–1).
 * Útil para facturas densas: bandas de la tabla para no perder filas.
 */
export async function cropImageBuffer(
  buffer: Buffer,
  region: { x: number; y: number; w: number; h: number }
): Promise<{ buffer: Buffer; mimeType: "image/png" }> {
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(buffer);
  const x = Math.max(0, Math.floor(img.width * region.x));
  const y = Math.max(0, Math.floor(img.height * region.y));
  const w = Math.max(1, Math.floor(img.width * region.w));
  const h = Math.max(1, Math.floor(img.height * region.h));
  const width = Math.min(w, img.width - x);
  const height = Math.min(h, img.height - y);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  return { buffer: canvas.toBuffer("image/png"), mimeType: "image/png" };
}

/**
 * Si el PNG es muy pesado, reencodea a JPEG para mantener detail high
 * sin superar límites prácticos del proveedor.
 */
export async function compressImageForVision(
  buffer: Buffer,
  maxBytes = 2_400_000
): Promise<{ buffer: Buffer; mimeType: "image/png" | "image/jpeg" }> {
  if (buffer.length <= maxBytes) {
    return { buffer, mimeType: "image/png" };
  }
  const { loadImage, createCanvas } = await import("@napi-rs/canvas");
  const img = await loadImage(buffer);
  const qualities = [0.88, 0.78, 0.68, 0.58];
  for (const q of qualities) {
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const jpeg = canvas.toBuffer("image/jpeg", q);
    if (jpeg.length <= maxBytes) {
      return { buffer: jpeg, mimeType: "image/jpeg" };
    }
  }
  const scale = 0.85;
  const canvas = createCanvas(
    Math.max(1, Math.floor(img.width * scale)),
    Math.max(1, Math.floor(img.height * scale))
  );
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { buffer: canvas.toBuffer("image/jpeg", 0.75), mimeType: "image/jpeg" };
}

export { anioFromVin } from "@/lib/importacion/vin-text";

