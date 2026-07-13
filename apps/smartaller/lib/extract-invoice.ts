import OpenAI from "openai";
import {
  createOpenAIClient,
  formatLlmAuthError,
  getVisionModelId,
  isOpenRouterKey,
} from "@/lib/ai/openai-config";
import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";

export type FacturaExtraida = {
  placa: string | null;
  kilometraje: number | null;
  descripcion: string | null;
  costo: number | null;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
};

const EXTRACTION_PROMPT =
  "Analiza esta factura de taller y extrae en formato JSON con estas claves: placa (string), kilometraje (number), costo (number), descripcion (string breve del servicio), nombre_cliente (string si aparece), telefono_cliente (string con dígitos si aparece). Si no encuentras algún dato, pon null. Responde solo con el JSON.";

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function parseKilometraje(value: unknown): number | null {
  if (typeof value === "number") return Math.round(value);
  if (typeof value === "string") {
    const n = parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseCosto(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseOpenAIJson(raw: string): FacturaExtraida {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    placa: parseString(parsed.placa)?.toUpperCase() ?? null,
    kilometraje: parseKilometraje(parsed.kilometraje),
    descripcion:
      parseString(parsed.descripcion) ??
      parseString(parsed.descripcion_servicio) ??
      parseString(parsed["descripción del servicio"]),
    costo: parseCosto(parsed.costo ?? parsed.costo_total),
    nombre_cliente: parseString(parsed.nombre_cliente),
    telefono_cliente: parseString(parsed.telefono_cliente),
  };
}

/** Extrae datos de factura enviando la URL pública del archivo de Telegram a GPT-4o-mini. */
export async function extractMantenimientoFromUrl(fileUrl: string): Promise<FacturaExtraida> {
  const openai = createOpenAIClient();

  try {
    const response = await openai.chat.completions.create({
      model: getVisionModelId(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: { url: fileUrl, detail: isOpenRouterKey() ? "low" : "auto" },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("OpenAI no devolvió contenido en la respuesta");
    }

    return parseOpenAIJson(raw);
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      throw new Error(formatLlmAuthError(err));
    }
    if (err instanceof SyntaxError) {
      throw new Error("OpenAI devolvió JSON inválido");
    }
    throw err;
  }
}

/** Compatibilidad: extracción desde buffer en base64 (fallback). */
export async function extractMantenimientoFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<FacturaExtraida> {
  const parsed = await createVisionJsonCompletion({
    prompt: EXTRACTION_PROMPT,
    imageBuffer,
    mimeType,
    maxTokens: 500,
  });
  return {
    placa: parseString(parsed.placa)?.toUpperCase() ?? null,
    kilometraje: parseKilometraje(parsed.kilometraje),
    descripcion:
      parseString(parsed.descripcion) ??
      parseString(parsed.descripcion_servicio) ??
      parseString(parsed["descripción del servicio"]),
    costo: parseCosto(parsed.costo ?? parsed.costo_total),
    nombre_cliente: parseString(parsed.nombre_cliente),
    telefono_cliente: parseString(parsed.telefono_cliente),
  };
}

export function buildFacturaProcesadaMessage(extraido: FacturaExtraida): string {
  const placa = extraido.placa ?? "N/A";
  const descripcion = extraido.descripcion ?? "Sin descripción";
  const costo =
    extraido.costo != null ? extraido.costo.toLocaleString("es-CO") : "N/A";

  return `¡Factura procesada! Vehículo: ${placa}, Servicio: ${descripcion}, Total: $${costo}. Todo guardado correctamente.`;
}
