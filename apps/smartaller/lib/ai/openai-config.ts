import OpenAI from "openai";

/** Config OpenAI directo o vía OpenRouter (clave sk-or-v1-...). */

export function getLlmApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function isOpenRouterKey(apiKey: string = getLlmApiKey()): boolean {
  return apiKey.startsWith("sk-or-");
}

export function getOpenAIBaseURL(): string | undefined {
  return isOpenRouterKey() ? "https://openrouter.ai/api/v1" : undefined;
}

/** Modelo de chat según proveedor. */
export function getChatModelId(): string {
  const custom = process.env.OPENAI_CHAT_MODEL?.trim();
  if (custom) return custom;
  return isOpenRouterKey() ? "openai/gpt-4o-mini" : "gpt-4o-mini";
}

/** Modelo de visión (placa, tablero, facturas). */
export function getVisionModelId(): string {
  const custom = process.env.OPENAI_VISION_MODEL?.trim();
  if (custom) return custom;
  return isOpenRouterKey() ? "openai/gpt-4o-mini" : "gpt-4o-mini";
}

export function isLlmConfigured(): boolean {
  const key = getLlmApiKey();
  if (!key) return false;
  if (key === "sk-..." || key.endsWith("...")) return false;
  return key.length > 20;
}

export function requireLlmApiKey(): string {
  const key = getLlmApiKey();
  if (!key) {
    throw new Error("Falta OPENAI_API_KEY en las variables de entorno");
  }
  return key;
}

/** Headers recomendados para OpenRouter (Referer exigido en producción). */
export function getOpenRouterHeaders(): Record<string, string> | undefined {
  if (!isOpenRouterKey()) return undefined;
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3003");
  const siteUrl = raw.startsWith("http") ? raw : `https://${raw.replace(/^https?:\/\//, "")}`;
  return {
    "HTTP-Referer": siteUrl,
    "X-Title": "SmartTaller",
  };
}

export function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: requireLlmApiKey(),
    baseURL: getOpenAIBaseURL(),
    defaultHeaders: getOpenRouterHeaders(),
  });
}

/** Mensaje amigable para errores de API de visión/chat. */
export function formatLlmAuthError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  if (err instanceof OpenAI.APIError) {
    msg = [err.status, err.message].filter(Boolean).join(" ");
  }
  if (/401|incorrect api key|invalid api key/i.test(msg)) {
    if (isOpenRouterKey()) {
      return "Clave OpenRouter inválida o expirada. Revisa OPENAI_API_KEY en Vercel (debe ser sk-or-v1-...).";
    }
    return "Clave OpenAI inválida. Usa sk-proj-... de OpenAI o sk-or-v1-... de OpenRouter en OPENAI_API_KEY.";
  }
  if (/400|provider returned error|image|too large|invalid image|payload/i.test(msg)) {
    return "No se pudo analizar la imagen con la IA. La foto se puede guardar igual; completa placa o kilometraje manualmente si hace falta.";
  }
  return msg;
}
