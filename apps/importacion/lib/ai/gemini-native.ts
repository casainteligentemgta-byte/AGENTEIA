/**
 * Cliente nativo de Gemini (generateContent).
 * El adaptador OpenAI (/v1beta/openai/chat/completions) devuelve 404 vacío
 * con claves nuevas de AI Studio; generateContent + ListModels sí funciona.
 */

import type OpenAI from "openai";

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

/** Orden de preferencia; ListModels decide cuáles existen en esta clave. */
const GEMINI_PREFERRED_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
] as const;

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

type GeminiListModelsResponse = {
  models?: Array<{
    name?: string;
    supportedGenerationMethods?: string[];
  }>;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code?: number; message?: string; status?: string };
};

let listedIds: string[] | null = null;
let workingModel: string | null = null;

function stripModelsPrefix(name: string): string {
  return name.replace(/^models\//, "");
}

function isUsableGenerateModel(id: string): boolean {
  const n = stripModelsPrefix(id).toLowerCase();
  if (!n.includes("gemini")) return false;
  if (/embed|image|tts|aqa|gemma|robotics/i.test(n)) return false;
  return true;
}

async function listGeminiModelIds(apiKey: string): Promise<string[]> {
  const res = await fetch(`${GEMINI_API_ROOT}/models?key=${encodeURIComponent(apiKey)}`, {
    method: "GET",
    headers: { "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(12_000),
  });
  const json = (await res.json().catch(() => ({}))) as GeminiListModelsResponse & {
    error?: { message?: string };
  };
  if (!res.ok) {
    const detail = json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Gemini ListModels: ${detail}`);
  }
  const ids: string[] = [];
  for (const m of json.models ?? []) {
    const raw = m.name?.trim();
    if (!raw) continue;
    const methods = m.supportedGenerationMethods ?? [];
    if (methods.length > 0 && !methods.includes("generateContent")) continue;
    const id = stripModelsPrefix(raw);
    if (isUsableGenerateModel(id)) ids.push(id);
  }
  return ids;
}

function pickFromAvailable(available: string[], preferred?: string): string | null {
  const set = new Set(available);
  const tryIds = [preferred, workingModel, ...GEMINI_PREFERRED_MODELS].filter(
    (x): x is string => Boolean(x)
  );
  for (const id of tryIds) {
    if (set.has(id)) return id;
  }
  const flash = available.find((id) => /flash/i.test(id));
  return flash ?? available[0] ?? null;
}

export async function resolveGeminiModelId(preferred?: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY");
  }
  if (workingModel && (!preferred || preferred === workingModel)) {
    return workingModel;
  }
  if (!listedIds) {
    try {
      listedIds = await listGeminiModelIds(apiKey);
    } catch {
      listedIds = [];
    }
  }
  if (listedIds.length === 0) {
    return preferred?.trim() || GEMINI_PREFERRED_MODELS[0];
  }
  const picked = pickFromAvailable(listedIds, preferred?.trim());
  if (!picked) {
    throw new Error(
      `Gemini no expone modelos de texto/visión en esta clave. Modelos vistos: ${listedIds.slice(0, 8).join(", ") || "(ninguno)"}.`
    );
  }
  return picked;
}

function parseDataUrl(url: string): { mime: string; data: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(url.trim());
  if (!m?.[1] || !m[2]) return null;
  return { mime: m[1], data: m[2] };
}

const GEMINI_INLINE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function toGeminiInline(
  parsed: { mime: string; data: string } | null
): { inline_data: { mime_type: string; data: string } } | null {
  if (!parsed?.data) return null;
  const mime = parsed.mime.split(";")[0].trim().toLowerCase();
  if (mime === "application/json" || mime === "text/html" || mime === "text/plain") {
    return null;
  }
  const mimeType = GEMINI_INLINE_MIMES.has(mime)
    ? mime
    : mime.startsWith("image/")
      ? "image/jpeg"
      : null;
  if (!mimeType) return null;
  return { inline_data: { mime_type: mimeType, data: parsed.data } };
}

function contentToParts(content: unknown): GeminiPart[] {
  if (typeof content === "string") return [{ text: content }];
  if (!Array.isArray(content)) return [{ text: String(content ?? "") }];
  const parts: GeminiPart[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const type = String(item.type ?? "");
    if (type === "text" && typeof item.text === "string") {
      parts.push({ text: item.text });
      continue;
    }
    if (type === "image_url") {
      const image = item.image_url;
      const url =
        typeof image === "string"
          ? image
          : image && typeof image === "object"
            ? String((image as { url?: string }).url ?? "")
            : "";
      const parsed = parseDataUrl(url);
      const inline = toGeminiInline(parsed);
      if (inline) parts.push(inline);
      continue;
    }
    if (type === "file") {
      const file = item.file as { file_data?: string } | undefined;
      const parsed = file?.file_data ? parseDataUrl(file.file_data) : null;
      const inline = toGeminiInline(parsed);
      if (inline) parts.push(inline);
    }
  }
  return parts.length > 0 ? parts : [{ text: "" }];
}

function messagesToGeminiContents(
  messages: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming["messages"]
): { contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>; system?: string } {
  let system = "";
  const contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }> = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : contentToParts(msg.content)
              .map((p) => ("text" in p ? p.text : ""))
              .join("\n");
      system = system ? `${system}\n${text}` : text;
      continue;
    }
    const role = msg.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: contentToParts(msg.content) });
  }
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: system || " " }] });
    system = "";
  } else if (system) {
    const first = contents[0]!;
    first.parts = [{ text: `${system}\n\n` }, ...first.parts];
  }
  return { contents, system: system || undefined };
}

function extractText(json: GeminiGenerateResponse): string {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function toChatCompletion(
  model: string,
  text: string,
  usage: GeminiGenerateResponse["usageMetadata"]
): OpenAI.Chat.Completions.ChatCompletion {
  const prompt = usage?.promptTokenCount ?? 0;
  const completion = usage?.candidatesTokenCount ?? 0;
  const total = usage?.totalTokenCount ?? prompt + completion;
  return {
    id: `gemini-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text,
          refusal: null,
        },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total,
    },
  } as OpenAI.Chat.Completions.ChatCompletion;
}

async function generateOnce(params: {
  apiKey: string;
  model: string;
  contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>;
  jsonMode: boolean;
  maxTokens: number;
  temperature: number;
}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const body: Record<string, unknown> = {
    contents: params.contents,
    generationConfig: {
      temperature: params.temperature,
      maxOutputTokens: Math.min(Math.max(params.maxTokens, 256), 8192),
      ...(params.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };
  const res = await fetch(
    `${GEMINI_API_ROOT}/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": params.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    }
  );
  const json = (await res.json().catch(() => ({}))) as GeminiGenerateResponse;
  if (!res.ok) {
    const msg =
      json.error?.message ??
      (res.status === 404
        ? `404 modelo ${params.model} no disponible`
        : `HTTP ${res.status}`);
    const err = new Error(msg);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const text = extractText(json);
  if (!text) {
    throw new Error("Gemini no devolvió texto");
  }
  workingModel = params.model;
  return toChatCompletion(params.model, text, json.usageMetadata);
}

function isNotFound(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    status === 404 ||
    /404|NOT_FOUND|no longer available|is not found/i.test(msg)
  );
}

/**
 * generateContent con reintento de modelos según ListModels.
 */
export async function geminiChatCompletion(
  params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY");
  }
  const jsonMode = params.response_format?.type === "json_object";
  const maxTokens =
    typeof params.max_tokens === "number" && params.max_tokens > 0
      ? params.max_tokens
      : 2048;
  const temperature =
    typeof params.temperature === "number" ? params.temperature : 0;
  const { contents } = messagesToGeminiContents(params.messages);
  const preferred =
    typeof params.model === "string" ? params.model : undefined;

  const first = await resolveGeminiModelId(preferred);
  const fromPreferred = listedIds?.length
    ? GEMINI_PREFERRED_MODELS.filter((id) => listedIds!.includes(id))
    : [...GEMINI_PREFERRED_MODELS];
  const queue = [...new Set([first, ...fromPreferred])].slice(0, 3);
  const seen = new Set<string>();
  let lastError: unknown;
  for (const model of queue) {
    if (!model || seen.has(model)) continue;
    seen.add(model);
    try {
      return await generateOnce({
        apiKey,
        model,
        contents,
        jsonMode,
        maxTokens,
        temperature,
      });
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (jsonMode && /mime type application\/json is not supported/i.test(msg)) {
        try {
          return await generateOnce({
            apiKey,
            model,
            contents,
            jsonMode: false,
            maxTokens,
            temperature,
          });
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
      if (!isNotFound(err)) throw lastError;
      if (workingModel === model) workingModel = null;
    }
  }
  const tried = [...seen].slice(0, 6).join(", ");
  throw lastError instanceof Error
    ? new Error(
        `Gemini 404: ningún modelo respondió (${tried}). En Vercel borra GEMINI_CHAT_MODEL y GEMINI_VISION_MODEL, o pon el id que sale en AI Studio (p. ej. gemini-3-flash-preview).`
      )
    : lastError;
}
