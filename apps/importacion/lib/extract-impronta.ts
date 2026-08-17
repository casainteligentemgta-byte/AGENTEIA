import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";
import { compactarSerial } from "@/lib/vehicles/serial";

export type ImprontaExtraida = {
  serial_carroceria: string | null;
  serial_motor: string | null;
  confianza: "alta" | "media" | "baja" | null;
};

const IMPRONTA_PROMPT = `Analiza esta foto de la impronta / placa de identificación / VIN / serial de carrocería o chasis de un vehículo.
Extrae en JSON:
- serial_carroceria (string: VIN, chasis o serial de carrocería visible; solo caracteres leídos, sin espacios)
- serial_motor (string si aparece un serial de motor distinto; si no, null)
- confianza ("alta" | "media" | "baja" según legibilidad)
Si no puedes leer el serial de carrocería/VIN, usa null.
Responde solo JSON.`;

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function parseConfianza(value: unknown): ImprontaExtraida["confianza"] {
  const raw = parseString(value)?.toLowerCase();
  if (raw === "alta" || raw === "media" || raw === "baja") return raw;
  return null;
}

export async function extractSerialImprontaFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<ImprontaExtraida> {
  const parsed = await createVisionJsonCompletion({
    prompt: IMPRONTA_PROMPT,
    imageBuffer,
    mimeType,
    maxTokens: 400,
  });

  const serial =
    parseString(parsed.serial_carroceria) ??
    parseString(parsed.vin) ??
    parseString(parsed.chasis) ??
    parseString(parsed.serial);

  return {
    serial_carroceria: serial ? compactarSerial(serial) || serial.toUpperCase() : null,
    serial_motor: parseString(parsed.serial_motor)?.toUpperCase() ?? null,
    confianza: parseConfianza(parsed.confianza),
  };
}
