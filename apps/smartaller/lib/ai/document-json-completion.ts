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
import { parseJsonOrSalvageVins } from "@/lib/ai/parse-llm-json";
import { isJsonOrHtmlPayload, sniffDocumentMime } from "@/lib/mime-document";

function isPdfMime(mimeType: string): boolean {
  return mimeType.toLowerCase().includes("pdf");
}

function resolveCompletionMime(buffer: Buffer, declared: string): string {
  try {
    return sniffDocumentMime({
      buffer,
      declaredMime: declared === "application/json" ? "" : declared,
    });
  } catch {
    if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") {
      return "application/pdf";
    }
    return declared && declared !== "application/json"
      ? declared
      : "application/pdf";
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

function keepPdfPageLines(text: string): string {
  return String(text ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Una cadena por página, con saltos de línea (tablas ENGINE No en página 2). */
export async function getPdfPagePlainTexts(buffer: Buffer): Promise<string[]> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer), { mergePages: false });
  const raw = result.text as unknown;
  const pages = Array.isArray(raw) ? raw : [raw];
  return pages.map((t) => keepPdfPageLines(String(t ?? "")));
}

/**
 * Raster para Tesseract / visión. Antes 4 páginas: facturas y COO de
 * 2+ páginas (tabla en pág. 2 o 3) se cortaban. 12 cubre el lote típico
 * sin volver a rasterizar 20 páginas a 2.6× (eso agotaba el timeout).
 */
export const PDF_RASTER_MAX_PAGES = 12;
/** Imágenes que se mandan juntas a Gemini (todas las páginas del PDF). */
export const PDF_VISION_MAX_PAGES = 12;

/** Marcas de escáner / basura típica que no es el contenido del documento. */
const SCANNER_JUNK_RE =
  /cam\s*scanner|scanned\s+by|scan\s*snap|adobe\s+scan|genius\s+scan|microsoft\s+lens|page\s+\d+\s+of\s+\d+/gi;

const DOC_SIGNAL_RE =
  /factura|invoice|proforma|vin|chasis|chassis|carrocer[ií]a|motor|vehicle|veh[ií]culo|buyer|consignee|importador|seller|vendedor|cif|fob|marca|model[oa]?|a[nñ]o|year|serial|bill\s*of\s*lading|\bbl\b|gu[ií]a|origen|certificate|certificado|dav|dua/i;

/**
 * Decide si el texto embebido del PDF basta para un LLM de texto.
 * CamScanner suele incrustar "Commercial Invoice" + watermark sin la tabla:
 * eso no sustituye leer el PDF nativo ni rasterizar.
 */
export function isUsefulPdfText(text: string): boolean {
  const cleaned = text.replace(SCANNER_JUNK_RE, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 80) return false;

  const letters = (cleaned.match(/[A-HJ-NPR-Z0-9ÁÉÍÓÚÜáéíóúüÑñ]/g) ?? []).length;
  if (letters / cleaned.length < 0.28) return false;

  const vinHits = cleaned.match(/\b[A-HJ-NPR-Z0-9]{17}\b/gi) ?? [];
  if (vinHits.length >= 2) return true;
  if (/S[O0Q]R[EF][A-Z0-9]{6,}/i.test(cleaned)) return true;

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  if (DOC_SIGNAL_RE.test(cleaned) && cleaned.length >= 400 && words.length >= 40) {
    return true;
  }
  return words.length >= 80;
}

/**
 * Rasteriza páginas de un PDF (p. ej. CamScanner sin texto) a PNG.
 * Requiere `@napi-rs/canvas` en el runtime Node.
 */
export async function renderPdfPagesAsPng(
  buffer: Buffer,
  options?: { maxPages?: number; scale?: number; startPage?: number }
): Promise<Buffer[]> {
  const maxPages = options?.maxPages ?? PDF_RASTER_MAX_PAGES;
  const scale = options?.scale ?? 2;
  const startPage = Math.max(1, options?.startPage ?? 1);
  const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const numPages = pdf.numPages ?? 1;
  if (startPage > numPages) return [];
  const last = Math.min(numPages, startPage + maxPages - 1);
  const pages: Buffer[] = [];

  for (let page = startPage; page <= last; page++) {
    const ab = await renderPageAsImage(pdf, page, {
      scale,
      canvasImport: () => import("@napi-rs/canvas"),
    });
    pages.push(Buffer.from(ab));
  }

  return pages;
}

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    return Math.max(1, Number(pdf.numPages) || 1);
  } catch {
    return 1;
  }
}

/** Pocos folios (factura+COO 1–3 págs.): más nitidez. Muchos: no agotar timeout. */
export function pdfRenderScaleForPageCount(pageCount: number): number {
  if (pageCount <= 2) return 2.8;
  if (pageCount <= 4) return 2.4;
  return 2.0;
}

/** Rasteriza todas las páginas del PDF (hasta el tope) a la escala adecuada. */
export async function rasterPdfForOcr(
  buffer: Buffer,
  options?: { maxPages?: number }
): Promise<{ pages: Buffer[]; pageCount: number; scale: number }> {
  const pageCount = await getPdfPageCount(buffer);
  const maxPages = options?.maxPages ?? PDF_RASTER_MAX_PAGES;
  const scale = pdfRenderScaleForPageCount(Math.min(pageCount, maxPages));
  const pages = await renderPdfPagesAsPng(buffer, { maxPages, scale });
  return { pages, pageCount, scale };
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
  preferHighDetail: boolean,
  timeoutMs?: number
): Promise<Record<string, unknown>> {
  const openai = createOpenAIClient({
    timeoutMs:
      timeoutMs ?? (maxTokens >= 4000 ? 120_000 : 90_000),
  });
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    {
      type: "text",
      text:
        pagePngs.length > 1
          ? `${prompt}\n\nHay ${pagePngs.length} páginas (imagen 1 = página 1, imagen 2 = página 2, …). Lee TODAS las páginas y TODAS las filas de las tablas. No te quedes en la carátula. No inventes datos que no se vean.`
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
    const pageCount = await getPdfPageCount(buffer);
    const scale =
      renderScale || pdfRenderScaleForPageCount(Math.min(pageCount, maxPdfPages));
    const pages = await renderPdfPagesAsPng(buffer, {
      maxPages: maxPdfPages,
      scale,
    });
    if (pages.length === 0) return null;
    return jsonFromPdfPageImages(prompt, pages, maxTokens, preferHighDetail);
  } catch {
    return null;
  }
}

/** Visión de páginas ya rasterizadas (todas las páginas del PDF o fotos). */
export async function createDocumentJsonFromPageImages(params: {
  prompt: string;
  pagePngs: Buffer[];
  maxTokens?: number;
  preferHighDetail?: boolean;
  timeoutMs?: number;
}): Promise<Record<string, unknown>> {
  const pages = params.pagePngs.filter((b) => b.length > 0);
  if (pages.length === 0) {
    throw new Error("No hay páginas de imagen para leer");
  }
  return jsonFromPdfPageImages(
    params.prompt,
    pages,
    params.maxTokens ?? 8000,
    params.preferHighDetail ?? true,
    params.timeoutMs
  );
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

function vehicleRecordHasVin(v: Record<string, unknown>): boolean {
  const vin = String(
    v.serial_carroceria ?? v.vin ?? v.chasis ?? v.code ?? ""
  ).replace(/[^A-Za-z0-9]/g, "");
  return vin.length >= 11;
}

function vehicleRecordHasMotor(v: Record<string, unknown>): boolean {
  const motor = String(
    v.serial_motor ?? v.engine_no ?? v.engine ?? v.motor ?? ""
  ).replace(/[^A-Za-z0-9]/g, "");
  return motor.length >= 6;
}

/** Puntuación para elegir entre texto embebido, PDF nativo y raster. */
export function scorePdfJsonExtract(data: Record<string, unknown>): number {
  const vehiculos = Array.isArray(data.vehiculos) ? data.vehiculos : [];
  let withVin = 0;
  let withMotor = 0;
  for (const raw of vehiculos) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    if (vehicleRecordHasVin(v)) withVin += 1;
    if (vehicleRecordHasMotor(v)) withMotor += 1;
  }
  return withVin * 10 + withMotor * 4 + countNonNullValues(data);
}

/** Al menos un VIN o dos ENGINE No: no aceptar cabecera vacía como “éxito”. */
export function pdfJsonExtractIsUsable(data: Record<string, unknown>): boolean {
  return scorePdfJsonExtract(data) >= 10;
}

function pickBestPdfJson(
  parts: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestScore = -1;
  for (const part of parts) {
    if (!part) continue;
    const score = scorePdfJsonExtract(part);
    if (score > bestScore) {
      best = part;
      bestScore = score;
    }
  }
  return best;
}

/** Gemini lee el PDF completo (tablas CamScanner) mejor que un raster comprimido. */
const NATIVE_PDF_MAX_BYTES = 12 * 1024 * 1024;

async function jsonFromNativePdf(
  prompt: string,
  buffer: Buffer,
  maxTokens: number,
  timeoutMs: number
): Promise<Record<string, unknown> | null> {
  if (buffer.length < 8 || buffer.length > NATIVE_PDF_MAX_BYTES) return null;
  if (buffer.toString("ascii", 0, 4) !== "%PDF") return null;
  try {
    const openai = createOpenAIClient({ timeoutMs });
    const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
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
            {
              type: "text",
              text: `${prompt}\n\nEl archivo adjunto es el PDF original (puede ser un escaneo CamScanner de 1 o 2 páginas). Lee TODAS las páginas y todas las filas de la tabla. No inventes datos.`,
            },
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
    if (!raw) return null;
    return parseJsonOrSalvageVins(raw);
  } catch {
    return null;
  }
}

/**
 * Extrae JSON desde foto (visión) o PDF.
 * PDF: 1) texto embebido útil  2) PDF nativo a Gemini (CamScanner)
 * 3) rasterizar páginas → visión  4) el mejor de los que hayan respondido.
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
   * Omite el camino de texto embebido (capa OCR basura de escáner)
   * y prioriza PDF nativo + raster.
   */
  forceRasterVision?: boolean;
  /** Preferir detail high en páginas rasterizadas (mejor lectura de factura). */
  preferHighDetail?: boolean;
  /** Escala de rasterización PDF (default 2; multi-factura 2.5–3). */
  renderScale?: number;
  /** Fotos extra del mismo documento (pág. 2 del certificado). */
  extraImageBuffers?: Buffer[];
  /** Tope de espera del PDF nativo / visión (ms). */
  timeoutMs?: number;
  /** No rasterizar: solo texto útil y PDF nativo (la etapa VIN hace Tesseract después). */
  skipRaster?: boolean;
}): Promise<Record<string, unknown>> {
  const maxTokens = params.maxTokens ?? 800;
  const maxTextChars = params.maxTextChars ?? 32000;
  const maxPdfPages = params.maxPdfPages ?? PDF_VISION_MAX_PAGES;
  const preferHighDetail = params.preferHighDetail ?? true;
  const renderScale = params.renderScale ?? 2;
  const timeoutMs = params.timeoutMs ?? (maxTokens >= 4000 ? 90_000 : 60_000);
  if (isJsonOrHtmlPayload(params.buffer)) {
    throw new Error(
      "El documento no es un PDF ni una foto (llegó JSON). Vuelve a subir el archivo y toca Extraer vehículos."
    );
  }
  const mime = resolveCompletionMime(
    params.buffer,
    params.mimeType || "application/octet-stream"
  );

  const extraImages = (params.extraImageBuffers ?? []).filter(
    (b) => b.length > 0
  );

  if (!isPdfMime(mime)) {
    if (extraImages.length > 0) {
      const pages = [params.buffer, ...extraImages];
      return jsonFromPdfPageImages(
        params.prompt,
        pages,
        maxTokens,
        preferHighDetail
      );
    }
    return createVisionJsonCompletion({
      prompt: params.prompt,
      imageBuffer: params.buffer,
      mimeType: mime,
      maxTokens,
      preferHighDetail,
    });
  }

  let fromText: Record<string, unknown> | null = null;
  if (!params.forceRasterVision) {
    try {
      const text = await extractTextFromPdf(params.buffer);
      if (isUsefulPdfText(text)) {
        fromText = await jsonFromTextPrompt(
          params.prompt,
          text,
          maxTokens,
          maxTextChars
        );
        if (fromText && pdfJsonExtractIsUsable(fromText)) {
          return fromText;
        }
      }
    } catch {
      // Continúa con raster de todas las páginas / PDF nativo.
    }
  }

  // CamScanner: visión de TODAS las páginas rasterizadas (file_data nativo
  // suele fallar en el proveedor; las fotos por página sí se leen).
  const fromRaster = params.skipRaster
    ? null
    : await rasterVisionFromPdf(
        params.prompt,
        params.buffer,
        maxTokens,
        maxPdfPages,
        preferHighDetail,
        renderScale
      );
  if (fromRaster && pdfJsonExtractIsUsable(fromRaster)) {
    return fromRaster;
  }

  const fromNative = await jsonFromNativePdf(
    params.prompt,
    params.buffer,
    maxTokens,
    timeoutMs
  );
  if (fromNative && pdfJsonExtractIsUsable(fromNative)) {
    return fromNative;
  }

  const best = pickBestPdfJson([fromText, fromRaster, fromNative]);
  if (best && (pdfJsonExtractIsUsable(best) || scorePdfJsonExtract(best) > 0)) {
    return best;
  }

  throw new Error(
    "No se pudo leer el PDF. Prueba con una foto nítida (JPG/PNG) de la factura o del certificado."
  );
}
