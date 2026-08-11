import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import { prepareImageForVision } from "@/lib/ai/prepare-vision-image";
import { extractVinStringsFromText } from "@/lib/importacion/vin-text";

function isProviderVisionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /400|provider returned error|image|too large|invalid/i.test(msg);
}

function parseJsonOrSalvageVins(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const vins = extractVinStringsFromText(raw);
    if (vins.length === 0) {
      throw new Error("La IA no devolvió JSON válido");
    }
    return {
      vehiculos: vins.map((vin) => ({
        serial_carroceria: vin,
        condicion: "nuevo",
        kilometraje: 0,
      })),
    };
  }
}

async function requestVisionCompletion(params: {
  prompt: string;
  dataUrl: string;
  detail: "low" | "high";
  maxTokens: number;
  jsonMode: boolean;
}): Promise<string> {
  const timeoutMs = params.maxTokens >= 4000 ? 120_000 : 45_000;
  const openai = createOpenAIClient({ timeoutMs });
  const response = await openai.chat.completions.create({
    model: getVisionModelId(),
    ...(params.jsonMode
      ? { response_format: { type: "json_object" as const } }
      : {}),
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
  /** Mejor lectura de texto en facturas / documentos. */
  preferHighDetail?: boolean;
}): Promise<Record<string, unknown>> {
  const prepared = prepareImageForVision(params.imageBuffer, params.mimeType, {
    preferHighDetail: params.preferHighDetail,
  });
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
    return parseJsonOrSalvageVins(raw);
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

      const trimmed = raw
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "");
      return parseJsonOrSalvageVins(trimmed);
    } catch (secondError) {
      if (params.softFail) return {};
      throw secondError;
    }
  }
}
