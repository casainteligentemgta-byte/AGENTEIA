import {
  createChatCompletion,
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import { trackLlmUsage } from "@/lib/ai/llm-usage";
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
  timeoutMs?: number;
}): Promise<string> {
  const timeoutMs =
    params.timeoutMs ??
    (params.maxTokens >= 4000 ? 90_000 : 45_000);
  const openai = createOpenAIClient({ timeoutMs });
  const model = getVisionModelId();
  const response = await createChatCompletion(openai, {
    model,
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

  trackLlmUsage({ model, usage: response.usage });

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

/**
 * Cosecha de VIN por visión sin exigir JSON (más fiable en tablas densas Chery).
 * Devuelve lista de VIN 17 chars; lanza si el proveedor falla.
 */
export async function createVisionVinListCompletion(params: {
  imageBuffer: Buffer;
  mimeType: string;
  preferHighDetail?: boolean;
  maxTokens?: number;
}): Promise<string[]> {
  const prepared = prepareImageForVision(params.imageBuffer, params.mimeType, {
    preferHighDetail: params.preferHighDetail ?? true,
  });
  const dataUrl = `data:${prepared.mimeType};base64,${prepared.buffer.toString("base64")}`;
  const maxTokens = params.maxTokens ?? 2000;
  const prompt = `Lee esta imagen de factura de vehículos (Chery / commercial invoice / hoja anexa).
Suele haber VARIAS filas (p. ej. 8 vehículos). Lista TODOS los números VIN / chasis de exactamente 17 caracteres visibles (columna Code o No. de Chasis).
Uno por línea. Solo letras y dígitos. No inventes. No omitas filas del medio ni del final.
Si no hay ninguno, responde NINGUNO.`;

  try {
    const raw = await requestVisionCompletion({
      prompt,
      dataUrl,
      detail: prepared.detail,
      maxTokens,
      jsonMode: false,
      timeoutMs: 50_000,
    });
    return extractVinStringsFromText(raw);
  } catch (firstError) {
    if (!isProviderVisionError(firstError)) throw firstError;
    const raw = await requestVisionCompletion({
      prompt,
      dataUrl,
      detail: "high",
      maxTokens,
      jsonMode: false,
      timeoutMs: 50_000,
    });
    return extractVinStringsFromText(raw);
  }
}
