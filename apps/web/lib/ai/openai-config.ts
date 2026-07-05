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
  return isOpenRouterKey() ? "openai/gpt-4o-mini" : "gpt-4o-mini";
}

/** Modelo de embeddings según proveedor. */
export function getEmbeddingModelId(): string {
  return isOpenRouterKey() ? "openai/text-embedding-3-small" : "text-embedding-3-small";
}

export function isLlmConfigured(): boolean {
  const key = getLlmApiKey();
  if (!key) return false;
  if (key === "sk-..." || key.endsWith("...")) return false;
  return key.length > 20;
}

/** Headers recomendados para OpenRouter (ranking y políticas del proveedor). */
export function getOpenRouterHeaders(): Record<string, string> | undefined {
  if (!isOpenRouterKey()) return undefined;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  return {
    "HTTP-Referer": appUrl ? `https://${appUrl.replace(/^https?:\/\//, "")}` : "https://agente-ia.local",
    "X-Title": process.env.NEXT_PUBLIC_AGENT_NAME?.trim() || "Agente IA",
  };
}
