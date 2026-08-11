import type OpenAI from "openai";
import {
  createOpenAIClient,
  getChatModelId,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";
import { prepareImageForVision } from "@/lib/ai/prepare-vision-image";

function isPdfMime(mimeType: string): boolean {
  return mimeType.toLowerCase().includes("pdf");
}

function stripJsonFence(raw: string): string {
  return raw.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: true });
  return String(result.text ?? "")
    .replace(/\s+/g, " ")
    .trim();
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
  const scale = options?.scale ?? 1.75;
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
  const openai = createOpenAIClient();
  const response = await openai.chat.completions.create({
    model: getChatModelId(),
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
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("La IA no devolvió una respuesta válida");
  return JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
}

async function jsonFromPdfPageImages(
  prompt: string,
  pagePngs: Buffer[],
  maxTokens: number
): Promise<Record<string, unknown>> {
  const openai = createOpenAIClient();
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text:
        pagePngs.length > 1
          ? `${prompt}\n\nLas imágenes siguientes son páginas consecutivas del mismo documento (escaneado). Usa TODAS las páginas.`
          : prompt,
    },
  ];

  for (const png of pagePngs) {
    const prepared = prepareImageForVision(png, "image/png");
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${prepared.mimeType};base64,${prepared.buffer.toString("base64")}`,
        detail: prepared.detail,
      },
    });
  }

  const response = await openai.chat.completions.create({
    model: getVisionModelId(),
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
  });
  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("La IA no devolvió una respuesta válida");
  return JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
}

/**
 * Extrae JSON desde foto (visión) o PDF.
 * PDF: 1) texto embebido → LLM  2) rasterizar páginas → visión (CamScanner / escaneos)
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
}): Promise<Record<string, unknown>> {
  const maxTokens = params.maxTokens ?? 800;
  const maxTextChars = params.maxTextChars ?? 12000;
  const mime = params.mimeType || "application/octet-stream";

  if (!isPdfMime(mime)) {
    return createVisionJsonCompletion({
      prompt: params.prompt,
      imageBuffer: params.buffer,
      mimeType: mime,
      maxTokens,
    });
  }

  try {
    const text = await extractTextFromPdf(params.buffer);
    if (text.length >= 40) {
      return jsonFromTextPrompt(params.prompt, text, maxTokens, maxTextChars);
    }
  } catch {
    // Continúa con rasterización / multimodal.
  }

  // PDFs escaneados (CamScanner, etc.): sin texto útil → convertir a imágenes.
  try {
    const pages = await renderPdfPagesAsPng(params.buffer, {
      maxPages: params.maxPdfPages ?? 4,
      scale: 1.75,
    });
    if (pages.length > 0) {
      return jsonFromPdfPageImages(params.prompt, pages, maxTokens);
    }
  } catch {
    // Último recurso: file_data (algunos providers no lo soportan).
  }

  const openai = createOpenAIClient();
  const dataUrl = `data:application/pdf;base64,${params.buffer.toString("base64")}`;

  try {
    const response = await openai.chat.completions.create({
      model: getVisionModelId(),
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
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("La IA no devolvió una respuesta válida");
    return JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
  } catch {
    throw new Error(
      "No se pudo leer el PDF. Prueba con una foto nítida (JPG/PNG) de la factura o del BL."
    );
  }
}
