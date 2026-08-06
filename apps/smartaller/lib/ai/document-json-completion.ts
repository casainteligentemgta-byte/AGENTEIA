import type OpenAI from "openai";
import {
  createOpenAIClient,
  getChatModelId,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";

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

/**
 * Extrae JSON desde foto (visión) o PDF (texto embebido → LLM; si no hay texto, intenta input file).
 */
export async function createDocumentJsonCompletion(params: {
  prompt: string;
  buffer: Buffer;
  mimeType: string;
  maxTokens?: number;
  /** Caracteres de texto PDF enviados al LLM (hojas anexas largas). */
  maxTextChars?: number;
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
    // Continúa con intento multimodal PDF.
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
