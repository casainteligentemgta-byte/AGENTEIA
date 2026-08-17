import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";

export type TableroExtraido = {
  kilometraje: number | null;
  lucesEncendidas: boolean | null;
};

const TABLERO_PROMPT =
  'Lee el odómetro en esta foto del tablero. JSON: {"kilometraje": number|null, "luces_encendidas": boolean|null}. Si no es legible, null.';

function parseKilometraje(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const n = parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export const AVISO_TABLERO_MANUAL =
  "No se pudo leer el kilometraje automáticamente. Ingrésalo en el campo de abajo.";

export async function extractTableroFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<TableroExtraido & { aviso?: string }> {
  try {
    const parsed = await createVisionJsonCompletion({
      prompt: TABLERO_PROMPT,
      imageBuffer,
      mimeType,
      maxTokens: 120,
      softFail: true,
    });

    const kilometraje = parseKilometraje(parsed.kilometraje);
    const lucesEncendidas =
      typeof parsed.luces_encendidas === "boolean" ? parsed.luces_encendidas : null;

    if (kilometraje == null) {
      return { kilometraje: null, lucesEncendidas, aviso: AVISO_TABLERO_MANUAL };
    }

    return { kilometraje, lucesEncendidas };
  } catch {
    return {
      kilometraje: null,
      lucesEncendidas: null,
      aviso: AVISO_TABLERO_MANUAL,
    };
  }
}
