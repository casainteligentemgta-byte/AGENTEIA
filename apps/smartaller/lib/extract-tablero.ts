import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";

export type TableroExtraido = {
  kilometraje: number | null;
  lucesEncendidas: boolean | null;
};

const TABLERO_PROMPT =
  "Analiza esta foto del tablero de un vehículo con el motor encendido. Extrae en JSON: kilometraje (number entero, odómetro en km u horas si aplica), luces_encendidas (boolean si se aprecian luces o testigos encendidos). Si no es legible, usa null. Responde solo JSON.";

function parseKilometraje(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function extractTableroFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<TableroExtraido> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const openai = createOpenAIClient();

  const response = await openai.chat.completions.create({
    model: getVisionModelId(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TABLERO_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    max_tokens: 200,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error("La IA no pudo leer el tablero");

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    kilometraje: parseKilometraje(parsed.kilometraje),
    lucesEncendidas:
      typeof parsed.luces_encendidas === "boolean" ? parsed.luces_encendidas : null,
  };
}
