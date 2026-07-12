/** Tamaño a partir del cual usar detail "low" en visión (evita 400 en OpenRouter). */
const LOW_DETAIL_THRESHOLD_BYTES = 400 * 1024;

/**
 * Prepara imagen para API de visión: fuerza MIME JPEG en data URL.
 * La reducción de tamaño la hace OpenAI/OpenRouter con detail "auto"/"low".
 */
export function prepareImageForVision(
  buffer: Buffer,
  mimeType: string
): { buffer: Buffer; mimeType: "image/jpeg"; detail: "low" | "high" } {
  const detail = buffer.length > LOW_DETAIL_THRESHOLD_BYTES ? "low" : "high";
  return {
    buffer,
    mimeType: "image/jpeg",
    detail,
  };
}
