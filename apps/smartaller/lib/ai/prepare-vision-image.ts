import { isOpenRouterKey } from "@/lib/ai/openai-config";
import { resolveImageMimeType } from "@/lib/mime-image";

/** Tamaño a partir del cual usar detail "low" en visión (evita 400 en OpenRouter). */
const LOW_DETAIL_THRESHOLD_BYTES = 200 * 1024;

export type PreparedVisionImage = {
  buffer: Buffer;
  mimeType: string;
  detail: "low" | "high";
};

/**
 * Prepara imagen para API de visión: MIME real por magic bytes y detail acorde al proveedor.
 */
export function prepareImageForVision(
  buffer: Buffer,
  mimeType: string
): PreparedVisionImage {
  const resolved =
    resolveImageMimeType({ declaredMime: mimeType, buffer }) ?? "image/jpeg";

  const preferLow =
    isOpenRouterKey() || buffer.length > LOW_DETAIL_THRESHOLD_BYTES;

  return {
    buffer,
    mimeType: resolved,
    detail: preferLow ? "low" : "high",
  };
}
