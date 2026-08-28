import OpenAI from "openai";
import { getAppBaseUrl } from "@/lib/app-url";

/**
 * Proveedores LLM:
 * 1. GEMINI_API_KEY → Google AI Studio (tier gratuito, visión incluida)
 * 2. OPENAI_API_KEY → OpenAI (sk-proj-...) u OpenRouter (sk-or-v1-...)
 */

export type LlmProvider = "gemini" | "openrouter" | "openai";

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

function isPlaceholderKey(key: string): boolean {
  return key === "sk-..." || key.endsWith("...") || key.length <= 20;
}

export function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

export function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

/** Clave activa: Gemini tiene prioridad (gratis) sobre OpenAI/OpenRouter. */
export function getLlmApiKey(): string {
  const gemini = getGeminiApiKey();
  if (gemini && !isPlaceholderKey(gemini)) return gemini;
  return getOpenAIApiKey();
}

export function getLlmProvider(): LlmProvider | null {
  const gemini = getGeminiApiKey();
  if (gemini && !isPlaceholderKey(gemini)) return "gemini";
  const openai = getOpenAIApiKey();
  if (!openai || isPlaceholderKey(openai)) return null;
  if (openai.startsWith("sk-or-")) return "openrouter";
  return "openai";
}

export function isOpenRouterKey(apiKey: string = getLlmApiKey()): boolean {
  return getLlmProvider() === "openrouter" || apiKey.startsWith("sk-or-");
}

export function isGeminiProvider(): boolean {
  return getLlmProvider() === "gemini";
}

/** Preferencia si ListModels no responde; las claves nuevas suelen exigir Gemini 3. */
export const GEMINI_DEFAULT_MODEL = "gemini-3-flash-preview";

export function isModelNotFoundError(err: unknown): boolean {
  const status = err instanceof OpenAI.APIError ? err.status : undefined;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 404 ||
    /404|NOT_FOUND|no longer available|model .+ not found|status code \(no body\)/i.test(
      msg
    )
  );
}

/**
 * chat.completions.create con reintento de modelo Gemini si el alias está deprecado.
 */
export async function createChatCompletion(
  openai: OpenAI,
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (isGeminiProvider()) {
    const { geminiChatCompletion } = await import("@/lib/ai/gemini-native");
    return geminiChatCompletion(params);
  }
  return openai.chat.completions.create(params);
}

export function getOpenAIBaseURL(): string | undefined {
  const provider = getLlmProvider();
  if (provider === "gemini") return GEMINI_OPENAI_BASE_URL;
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  return undefined;
}

/** Modelo de chat según proveedor. */
export function getChatModelId(): string {
  const custom =
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.GEMINI_CHAT_MODEL?.trim();
  if (custom) return custom;
  const provider = getLlmProvider();
  if (provider === "gemini") return GEMINI_DEFAULT_MODEL;
  if (provider === "openrouter") return "openai/gpt-4o-mini";
  return "gpt-4o-mini";
}

/** Modelo de visión (placa, tablero, facturas). */
export function getVisionModelId(): string {
  const custom =
    process.env.OPENAI_VISION_MODEL?.trim() ||
    process.env.GEMINI_VISION_MODEL?.trim();
  if (custom) return custom;
  const provider = getLlmProvider();
  if (provider === "gemini") return GEMINI_DEFAULT_MODEL;
  if (provider === "openrouter") return "openai/gpt-4o-mini";
  return "gpt-4o-mini";
}

export function isLlmConfigured(): boolean {
  return getLlmProvider() !== null;
}

export function requireLlmApiKey(): string {
  const key = getLlmApiKey();
  if (!key || isPlaceholderKey(key)) {
    throw new Error(
      "Falta GEMINI_API_KEY (gratis) u OPENAI_API_KEY en las variables de entorno"
    );
  }
  return key;
}

/** Headers recomendados para OpenRouter (Referer exigido en producción). */
export function getOpenRouterHeaders(): Record<string, string> | undefined {
  if (getLlmProvider() !== "openrouter") return undefined;
  const siteUrl = getAppBaseUrl();
  return {
    "HTTP-Referer": siteUrl,
    "X-Title": "SmartTaller",
  };
}

export function createOpenAIClient(options?: {
  /** Timeout por request (default 25s). Documentos/OCR pueden necesitar más. */
  timeoutMs?: number;
}): OpenAI {
  return new OpenAI({
    apiKey: requireLlmApiKey(),
    baseURL: getOpenAIBaseURL(),
    defaultHeaders: getOpenRouterHeaders(),
    /** Evita que OCR/visión deje la UI colgada en “Guardando…”. */
    timeout: options?.timeoutMs ?? 25_000,
    maxRetries: 1,
  });
}

/** Mensaje amigable para errores de API de visión/chat. */
export function formatLlmAuthError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  if (err instanceof OpenAI.APIError) {
    msg = [err.status, err.message].filter(Boolean).join(" ");
  }
  if (
    /402|insufficient credits|never purchased credits|purchase more credits|payment required/i.test(
      msg
    )
  ) {
    if (isGeminiProvider()) {
      return "Cuota gratuita de Gemini agotada o modelo de pago. Prueba más tarde o usa gemini-2.5-flash.";
    }
    if (isOpenRouterKey()) {
      return "OpenRouter sin créditos. Añade GEMINI_API_KEY (gratis en Google AI Studio) en Vercel, o recarga OpenRouter. El OCR local (Tesseract) sigue intentando leer VIN sin créditos.";
    }
    return "La API de IA rechazó la petición (pago/créditos). Revisa la facturación de la clave en Vercel.";
  }
  if (/401|403|incorrect api key|invalid api key|API_KEY_INVALID/i.test(msg)) {
    if (isGeminiProvider()) {
      return "Clave Gemini inválida. Crea una en https://aistudio.google.com/apikey y ponla en GEMINI_API_KEY (Vercel).";
    }
    if (isOpenRouterKey()) {
      return "Clave OpenRouter inválida o expirada. Revisa OPENAI_API_KEY en Vercel (debe ser sk-or-v1-...).";
    }
    return "Clave OpenAI inválida. Usa sk-proj-... de OpenAI, sk-or-v1-... de OpenRouter, o GEMINI_API_KEY gratis.";
  }
  if (
    /404|NOT_FOUND|no longer available|status code \(no body\)/i.test(msg) ||
    (err instanceof OpenAI.APIError && err.status === 404)
  ) {
    if (isGeminiProvider()) {
      return "Gemini no encontró un modelo disponible (404). En Vercel borra GEMINI_CHAT_MODEL y GEMINI_VISION_MODEL (el código elige uno con ListModels). Si las definiste, usa el id de AI Studio, p. ej. gemini-3-flash-preview.";
    }
    return "La API de IA no encontró el modelo (404). Revisa GEMINI_CHAT_MODEL / OPENAI_CHAT_MODEL en Vercel.";
  }
  if (/429|rate limit|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    if (isGeminiProvider()) {
      return "Límite gratuito de Gemini alcanzado (RPM/día). Espera un momento o reduce el tamaño del PDF.";
    }
    return "Límite de la API de IA alcanzado. Espera un momento e intenta de nuevo.";
  }
  if (
    /application\/json/i.test(msg) &&
    /not supported|unsupported mime/i.test(msg)
  ) {
    return "La IA rechazó el formato JSON. Vuelve a tocar Procesar; si falla, recarga la página.";
  }
  if (/400|provider returned error|image|too large|invalid image|payload/i.test(msg)) {
    // Conservar diagnósticos de carga masiva / VIN
    if (/Sin VIN|raster:|pagina-1|col-code|json-harvest|tesseract/i.test(msg)) {
      return msg;
    }
    return "No se pudo analizar la imagen con la IA. Prueba otra foto más nítida o un PDF más liviano.";
  }
  if (/timeout|timed out|aborted|ETIMEDOUT|AbortError/i.test(msg)) {
    return "La IA tardó demasiado. La foto puede guardarse igual; reintenta o completa los datos a mano.";
  }
  return msg;
}
