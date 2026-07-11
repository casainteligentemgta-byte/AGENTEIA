import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";

export type CedulaExtraida = {
  numero_cedula: string | null;
  nombre_completo: string | null;
  fecha_nacimiento: string | null;
};

export type TituloPropiedadExtraido = {
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serial_motor: string | null;
  serial_carroceria: string | null;
  cedula_propietario: string | null;
  nombre_propietario: string | null;
};

const CEDULA_PROMPT =
  "Analiza esta imagen de una cédula de ciudadanía colombiana (o documento de identidad). Extrae en JSON: numero_cedula (string solo dígitos), nombre_completo (string con nombres y apellidos), fecha_nacimiento (string formato YYYY-MM-DD si aparece). Si no encuentras un dato, usa null. Responde solo JSON.";

const TITULO_PROMPT =
  "Analiza esta imagen de un título de propiedad vehicular colombiano (tarjeta de propiedad / licencia de tránsito). Extrae en JSON: placa, marca, modelo, color, serial_motor, serial_carroceria (o chasis/VIN), cedula_propietario (solo dígitos), nombre_propietario. Si no encuentras un dato, usa null. Responde solo JSON.";

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function parseCedulaDigits(value: unknown): string | null {
  const raw = parseString(value);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

async function extractJsonFromImage(
  imageDataUrl: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const openai = createOpenAIClient();

  const response = await openai.chat.completions.create({
    model: getVisionModelId(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    max_tokens: 600,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("La IA no devolvió datos del documento");
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

function parseFechaNacimiento(value: unknown): string | null {
  const raw = parseString(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

export async function extractCedulaFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<CedulaExtraida> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const parsed = await extractJsonFromImage(dataUrl, CEDULA_PROMPT);

  return {
    numero_cedula: parseCedulaDigits(parsed.numero_cedula),
    nombre_completo: parseString(parsed.nombre_completo),
    fecha_nacimiento: parseFechaNacimiento(parsed.fecha_nacimiento),
  };
}

export async function extractTituloPropiedadFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg"
): Promise<TituloPropiedadExtraido> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  const parsed = await extractJsonFromImage(dataUrl, TITULO_PROMPT);

  return {
    placa: parseString(parsed.placa)?.toUpperCase().replace(/\s/g, "") ?? null,
    marca: parseString(parsed.marca),
    modelo: parseString(parsed.modelo),
    color: parseString(parsed.color),
    serial_motor: parseString(parsed.serial_motor),
    serial_carroceria:
      parseString(parsed.serial_carroceria) ??
      parseString(parsed.chasis) ??
      parseString(parsed.vin),
    cedula_propietario: parseCedulaDigits(parsed.cedula_propietario),
    nombre_propietario: parseString(parsed.nombre_propietario),
  };
}
