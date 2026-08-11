/**
 * Rotación de imágenes para OCR (fotos de hoja anexa / factura en horizontal).
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

/** Año del modelo según dígito 10 del VIN (ciclo 2010–2039). */
export function anioFromVin(vin: string | null | undefined): number | null {
  const v = (vin ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (v.length < 10) return null;
  const code = v[9]!;
  const map: Record<string, number> = {
    A: 2010,
    B: 2011,
    C: 2012,
    D: 2013,
    E: 2014,
    F: 2015,
    G: 2016,
    H: 2017,
    J: 2018,
    K: 2019,
    L: 2020,
    M: 2021,
    N: 2022,
    P: 2023,
    R: 2024,
    S: 2025,
    T: 2026,
    V: 2027,
    W: 2028,
    X: 2029,
    Y: 2030,
    "1": 2031,
    "2": 2032,
    "3": 2033,
    "4": 2034,
    "5": 2035,
    "6": 2036,
    "7": 2037,
    "8": 2038,
    "9": 2039,
  };
  return map[code] ?? null;
}
