import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";

export type PlacaExtraida = {
  placa: string | null;
  confianza: "alta" | "baja" | null;
};

const PLACA_PROMPT =
  "Analiza esta foto de un vehículo (vista frontal, trasera o lateral). Extrae SOLO la placa o matrícula visible en JSON: placa (string en mayúsculas sin espacios, formato colombiano o latinoamericano si aplica), confianza (alta si la placa es claramente legible, baja si es dudosa). Si no hay placa visible, placa: null. Responde solo JSON.";

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizePlaca(raw: string): string {
  return raw.toUpperCase().replace(/[\s\-.]/g, "");
}

export async function extractPlacaFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<PlacaExtraida> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const openai = createOpenAIClient();

  const response = await openai.chat.completions.create({
    model: getVisionModelId(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PLACA_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 200,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("La IA no detectó placa en la imagen");
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const placaRaw = parseString(parsed.placa);
  const confianzaRaw = parseString(parsed.confianza);

  return {
    placa: placaRaw ? normalizePlaca(placaRaw) : null,
    confianza: confianzaRaw === "alta" || confianzaRaw === "baja" ? confianzaRaw : null,
  };
}
