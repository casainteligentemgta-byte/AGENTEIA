import type OpenAI from "openai";
import {
  createChatCompletion,
  createOpenAIClient,
  getChatModelId,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import { trackLlmUsage } from "@/lib/ai/llm-usage";
import { compressImageForVision } from "@/lib/ai/image-orient";
import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";
import { prepareImageForVision } from "@/lib/ai/prepare-vision-image";
import { extractVinStringsFromText } from "@/lib/importacion/vin-text";
import { isPdfDocument } from "@/lib/mime-document";

function stripJsonFence(raw: string): string {
  return raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
}

function parseJsonOrSalvageVins(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
  } catch {
    const vins = extractVinStringsFromText(raw);
    if (vins.length === 0) throw new Error("La IA no devolvió JSON válido");
    return {
      vehiculos: vins.map((vin) => ({
        serial_carroceria: vin,
        condicion: "nuevo",
        kilometraje: 0,
      })),
    };
  }
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: true });
  return String(result.text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto plano de un PDF (para parsers deterministas de tablas). */
export async function getPdfPlainText(buffer: Buffer): Promise<string> {
  return extractTextFromPdf(buffer);
}

/** Marcas de escáner / basura típica que no es el contenido del documento. */
const SCANNER_JUNK_RE =
  /cam\s*scanner|scanned\s+by|scan\s*snap|adobe\s+scan|genius\s+scan|microsoft\s+lens|page\s+\d+\s+of\s+\d+/gi;

const DOC_SIGNAL_RE =
  /factura|invoice|proforma|vin|chasis|chassis|carrocer[ií]a|motor|vehicle|veh[ií]culo|buyer|consignee|importador|seller|vendedor|cif|fob|marca|model[oa]?|a[nñ]o|year|serial|bill\s*of\s*lading|\bbl\b|gu[ií]a|origen|certificate|certificado|dav|dua/i;

/**
 * Decide si el texto embebido del PDF es útil para OCR por LLM de texto.
 * PDFs de CamScanner a menudo traen watermarks ≥ 40 chars sin el contenido real;
 * en ese caso hay que rasterizar y usar visión.
 */
export function isUsefulPdfText(text: string): boolean {
  const cleaned = text.replace(SCANNER_JUNK_RE, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 80) return false;

  const letters = (cleaned.match(/[A-Za-zÁÉÍÓÚÜáéíóúüÑñ]/g) ?? []).length;
  if (letters / cleaned.length < 0.3) return false;

  if (DOC_SIGNAL_RE.test(cleaned)) return true;
  if (/\b[A-HJ-NPR-Z0-9]{17}\b/i.test(cleaned)) return true;

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  return words.length >= 30;
}

/**
 * Rasteriza páginas de un PDF (p. ej. CamScanner sin texto) a PNG.
 * Requiere `@napi-rs/canvas` en el runtime Node.
 */
export async function renderPdfPagesAsPng(
  buffer: Buffer,
  options?: { maxPages?: number; scale?: number }
): Promise<Buffer[]> {
  const maxPages = options?.maxPages ?? 4;
  const scale = options?.scale ?? 2;
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const total = Math.min(pdf.numPages ?? 1, maxPages);
  const pages: Buffer[] = [];

  for (let page = 1; page <= total; page++) {
    const ab = await renderPageAsImage(pdf, page, {
      scale,
      canvasImport: () => import("@napi-rs/canvas"),
    });
    pages.push(Buffer.from(ab));
  }

  return pages;
}

async function jsonFromTextPrompt(
  prompt: string,
  documentText: string,
  maxTokens: number,
  maxTextChars: number
): Promise<Record<string, unknown>> {
  const openai = createOpenAIClient({ timeoutMs: 45_000 });
  const model = getChatModelId();
  const response = await createChatCompletion(openai, {
    model,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: maxTokens,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\nTexto del documento:\n"""\n${documentText.slice(0, maxTextChars)}\n"""`,
      },
    ],
  });
  trackLlmUsage({ model, usage: response.usage });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("La IA no devolvió una respuesta válida");
  return parseJsonOrSalvageVins(raw);
}

async function jsonFromPdfPageImages(
  prompt: string,
  pagePngs: Buffer[],
  maxTokens: number,
  preferHighDetail: boolean
): Promise<Record<string, unknown>> {
  const openai = createOpenAIClient({
    timeoutMs: maxTokens >= 4000 ? 120_000 : 90_000,
  });
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text:
        pagePngs.length > 1
          ? `${prompt}\n\nLas imágenes siguientes son páginas consecutivas del mismo documento (escaneado). Lee el texto visible en TODAS las páginas. No inventes datos que no se vean.`
          : `${prompt}\n\nLee el texto visible en la imagen. No inventes datos que no se vean.`,
    },
  ];

  for (const png of pagePngs) {
    const sized = await compressImageForVision(png);
    const prepared = prepareImageForVision(sized.buffer, sized.mimeType, {
      preferHighDetail,
    });
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${prepared.mimeType};base64,${prepared.buffer.toString("base64")}`,
        detail: prepared.detail,
      },
    });
  }

  try {
    const model = getVisionModelId();
    const response = await createChatCompletion(openai, {
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: maxTokens,
      messages: [{ role: "user", content }],
    });
    trackLlmUsage({ model, usage: response.usage });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("La IA no devolvió una respuesta válida");
    return parseJsonOrSalvageVins(raw);
  } catch (firstError) {
    // Reintento con detail low si el provider rechaza high/payload.
    if (!preferHighDetail) throw firstError;
    const lowContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      content[0]!,
    ];
    for (const png of pagePngs) {
      const sized = await compressImageForVision(png);
      const prepared = prepareImageForVision(sized.buffer, sized.mimeType, {
        preferHighDetail: false,
        forceDetail: "low",
      });
      lowContent.push({
        type: "image_url",
        image_url: {
          url: `data:${prepared.mimeType};base64,${prepared.buffer.toString("base64")}`,
          detail: "low",
        },
      });
    }
    const model = getVisionModelId();
    const response = await createChatCompletion(openai, {
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: lowContent }],
    });
    trackLlmUsage({ model, usage: response.usage });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw firstError;
    return parseJsonOrSalvageVins(raw);
  }
}

async function rasterVisionFromPdf(
  prompt: string,
  buffer: Buffer,
  maxTokens: number,
  maxPdfPages: number,
  preferHighDetail: boolean,
  renderScale: number
): Promise<Record<string, unknown> | null> {
  try {
    const pages = await renderPdfPagesAsPng(buffer, {
      maxPages: maxPdfPages,
      scale: renderScale,
    });
    if (pages.length === 0) return null;
    return jsonFromPdfPageImages(prompt, pages, maxTokens, preferHighDetail);
  } catch {
    return null;
  }
}

function countNonNullValues(data: Record<string, unknown>): number {
  return Object.values(data).filter((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "boolean") return true;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return false;
  }).length;
}

/**
 * Extrae JSON desde foto (visión) o PDF.
 * PDF: 1) texto embebido útil → LLM  2) rasterizar páginas → visión (CamScanner / escaneos)
 * 3) último recurso: enviar PDF como file_data.
 */
export async function createDocumentJsonCompletion(params: {
  prompt: string;
  buffer: Buffer;
  mimeType: string;
  maxTokens?: number;
  /** Caracteres de texto PDF enviados al LLM (hojas anexas largas). */
  maxTextChars?: number;
  /** Máx. páginas a rasterizar si el PDF no tiene texto. */
  maxPdfPages?: number;
  /**
   * Omite el camino de texto embebido y fuerza raster+visión
   * (útil cuando el texto del PDF es basura de escáner).
   */
  forceRasterVision?: boolean;
  /** Preferir detail high en páginas rasterizadas (mejor lectura de factura). */
  preferHighDetail?: boolean;
  /** Escala de rasterización PDF (default 2; multi-factura 2.5–3). */
  renderScale?: number;
}): Promise<Record<string, unknown>> {
  const maxTokens = params.maxTokens ?? 800;
  const maxTextChars = params.maxTextChars ?? 12000;
  const maxPdfPages = params.maxPdfPages ?? 4;
  const preferHighDetail = params.preferHighDetail ?? true;
  const renderScale = params.renderScale ?? 2;
  const mime = isPdfDocument(params.buffer, params.mimeType)
    ? "application/pdf"
    : params.mimeType || "application/octet-stream";

  if (!isPdfDocument(params.buffer, mime)) {
    return createVisionJsonCompletion({
      prompt: params.prompt,
      imageBuffer: params.buffer,
      mimeType: mime,
      maxTokens,
      preferHighDetail,
    });
  }

  if (!params.forceRasterVision) {
    try {
      const text = await extractTextFromPdf(params.buffer);
      if (isUsefulPdfText(text)) {
        const fromText = await jsonFromTextPrompt(
          params.prompt,
          text,
          maxTokens,
          maxTextChars
        );
        // Si el texto era “útil” pero el modelo casi no extrajo nada,
        // reintentar con visión (texto basura que pasó el filtro).
        if (countNonNullValues(fromText) >= 2) {
          return fromText;
        }
      }
    } catch {
      // Continúa con rasterización / multimodal.
    }
  }

  // PDFs escaneados (CamScanner, etc.): sin texto útil → convertir a imágenes.
  const fromRaster = await rasterVisionFromPdf(
    params.prompt,
    params.buffer,
    maxTokens,
    maxPdfPages,
    preferHighDetail,
    renderScale
  );
  if (fromRaster) return fromRaster;

  const openai = createOpenAIClient({ timeoutMs: 60_000 });
  const dataUrl = `data:application/pdf;base64,${params.buffer.toString("base64")}`;

  try {
    const model = getVisionModelId();
    const response = await createChatCompletion(openai, {
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: params.prompt },
            {
              type: "file",
              file: {
                filename: "documento.pdf",
                file_data: dataUrl,
              },
            } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart,
          ],
        },
      ],
    });
    trackLlmUsage({ model, usage: response.usage });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("La IA no devolvió una respuesta válida");
    return parseJsonOrSalvageVins(raw);
  } catch {
    throw new Error(
      "No se pudo leer el PDF. Prueba con una foto nítida (JPG/PNG) de la factura o del BL."
    );
  }
}
