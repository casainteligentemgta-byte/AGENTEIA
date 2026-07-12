import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";

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
  const parsed = await createVisionJsonCompletion({
    prompt: TABLERO_PROMPT,
    imageBuffer,
    mimeType,
    maxTokens: 200,
  });

  return {
    kilometraje: parseKilometraje(parsed.kilometraje),
    lucesEncendidas:
      typeof parsed.luces_encendidas === "boolean" ? parsed.luces_encendidas : null,
  };
}
