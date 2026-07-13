import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import { prepareImageForVision } from "@/lib/ai/prepare-vision-image";

function isProviderVisionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /400|provider returned error|image|too large|invalid/i.test(msg);
}

async function requestVisionCompletion(params: {
  prompt: string;
  dataUrl: string;
  detail: "low" | "high";
  maxTokens: number;
  jsonMode: boolean;
}): Promise<string> {
  const openai = createOpenAIClient();
  const response = await openai.chat.completions.create({
    model: getVisionModelId(),
    ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.prompt },
          {
            type: "image_url",
            image_url: { url: params.dataUrl, detail: params.detail },
          },
        ],
      },
    ],
    max_tokens: params.maxTokens,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("La IA no devolvió una respuesta válida");
  }
  return raw;
}

export async function createVisionJsonCompletion(params: {
  prompt: string;
  imageBuffer: Buffer;
  mimeType: string;
  maxTokens?: number;
  /** Si true, devuelve {} cuando el proveedor rechaza la imagen (p. ej. tablero). */
  softFail?: boolean;
}): Promise<Record<string, unknown>> {
  const prepared = prepareImageForVision(params.imageBuffer, params.mimeType);
  const dataUrl = `data:${prepared.mimeType};base64,${prepared.buffer.toString("base64")}`;
  const maxTokens = params.maxTokens ?? 300;

  try {
    const raw = await requestVisionCompletion({
      prompt: params.prompt,
      dataUrl,
      detail: prepared.detail,
      maxTokens,
      jsonMode: true,
    });
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (firstError) {
    if (!isProviderVisionError(firstError)) throw firstError;

    try {
      const raw = await requestVisionCompletion({
        prompt: `${params.prompt}\n\nResponde ÚNICAMENTE con un objeto JSON válido, sin markdown.`,
        dataUrl,
        detail: "low",
        maxTokens,
        jsonMode: false,
      });

      const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch (secondError) {
      if (params.softFail) return {};
      throw secondError;
    }
  }
}
