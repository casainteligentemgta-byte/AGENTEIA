import { isOpenRouterKey } from "@/lib/ai/openai-config";
import { resolveImageMimeType } from "@/lib/mime-image";

/** Tamaño a partir del cual usar detail "low" en visión (evita 400 en OpenRouter). */
const LOW_DETAIL_THRESHOLD_BYTES = 200 * 1024;
/**
 * Con preferHighDetail, solo forzar low si la imagen es enorme.
 * Facturas multi-VIN rasterizadas a ~2.5–3 MB necesitan high detail;
 * el umbral anterior (2.5 MB) hacía caer a low y solo se leían 1–2 filas.
 */
const HIGH_DETAIL_MAX_BYTES = 5_500_000;

export type PreparedVisionImage = {
  buffer: Buffer;
  mimeType: string;
  detail: "low" | "high";
};

export type PrepareVisionImageOptions = {
  /**
   * Para facturas/documentos: preferir detail high (mejor lectura de texto).
   * Sigue bajando a low si el buffer es enorme o si se fuerza.
   */
  preferHighDetail?: boolean;
  forceDetail?: "low" | "high";
};

/**
 * Prepara imagen para API de visión: MIME real por magic bytes y detail acorde al proveedor.
 */
export function prepareImageForVision(
  buffer: Buffer,
  mimeType: string,
  options?: PrepareVisionImageOptions
): PreparedVisionImage {
  const resolved =
    resolveImageMimeType({ declaredMime: mimeType, buffer }) ?? "image/jpeg";

  if (options?.forceDetail) {
    return { buffer, mimeType: resolved, detail: options.forceDetail };
  }

  if (options?.preferHighDetail) {
    const detail =
      buffer.length > HIGH_DETAIL_MAX_BYTES ? "low" : "high";
    return { buffer, mimeType: resolved, detail };
  }

  const preferLow =
    isOpenRouterKey() || buffer.length > LOW_DETAIL_THRESHOLD_BYTES;

  return {
    buffer,
    mimeType: resolved,
    detail: preferLow ? "low" : "high",
  };
}
