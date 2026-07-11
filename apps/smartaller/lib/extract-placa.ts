import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import {
  compactarPlaca,
  esPlacaPlausible,
  generarVariantesOcrPlaca,
} from "@/lib/vehicles/placa";

export type ContextoFotoPlaca = "frontal" | "placa";

export type PlacaExtraida = {
  placa: string | null;
  confianza: "alta" | "baja" | null;
  /** Placa alternativa si la IA duda entre dos lecturas */
  placaAlternativa?: string | null;
};

const PROMPTS: Record<ContextoFotoPlaca, string> = {
  frontal: `Eres un experto leyendo placas vehiculares en Colombia.
La imagen es una foto FRONTAL del vehículo (se ve el auto completo o el frente).
Tu ÚNICA tarea: leer la placa/matrícula del vehículo en el parachoques, parrilla o portaplacas delantero.

REGLAS ESTRICTAS:
- Lee SOLO la placa oficial del vehículo (lámina metálica o acrílica con letras y números).
- IGNORA por completo: VIN, chasis, stickers, concesionario, marca del carro, parabrisas, motor, decoración.
- Formato típico Colombia: 3 letras + 3 números (ej. ABC123). También motos AB123C o formatos antiguos.
- Distingue bien: O vs 0, I vs 1, Z vs 2, S vs 5, B vs 8.
- Si la placa no se lee con claridad, devuelve placa: null (no inventes).

Responde SOLO JSON:
{
  "placa": "ABC123 o null",
  "confianza": "alta" | "baja" | null,
  "placa_alternativa": "otra lectura posible o null",
  "motivo": "breve: dónde viste la placa o por qué es null"
}`,

  placa: `Eres un experto leyendo placas vehiculares en Colombia.
La imagen es un primer plano de la placa/matrícula del vehículo.
Lee exactamente los caracteres visibles. Formato típico: ABC123 (3 letras + 3 números).
IGNORA marcos, tornillos y texto que no sea la placa.
Distingue: O/0, I/1, Z/2, S/5, B/8.
Si no es legible: placa null.

Responde SOLO JSON:
{
  "placa": "ABC123 o null",
  "confianza": "alta" | "baja" | null,
  "placa_alternativa": "otra lectura o null"
}`,
};

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function elegirMejorPlaca(
  principal: string | null,
  alternativa: string | null
): { placa: string | null; confianza: "alta" | "baja" | null } {
  const candidatos = [principal, alternativa]
    .filter((p): p is string => Boolean(p))
    .map(compactarPlaca)
    .filter(esPlacaPlausible);

  if (candidatos.length === 0) {
    const fallback = principal ? compactarPlaca(principal) : null;
    if (fallback && fallback.length >= 5 && fallback.length <= 8) {
      return { placa: fallback, confianza: "baja" };
    }
    return { placa: null, confianza: null };
  }

  const mejor = candidatos[0];
  const plausiblePrincipal = principal && esPlacaPlausible(compactarPlaca(principal));
  return {
    placa: mejor,
    confianza: plausiblePrincipal ? "alta" : "baja",
  };
}

export async function extractPlacaFromImage(
  imageBuffer: Buffer,
  mimeType: string = "image/jpeg",
  contexto: ContextoFotoPlaca = "frontal"
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
          { type: "text", text: PROMPTS[contexto] },
          {
            type: "image_url",
            image_url: { url: dataUrl, detail: "high" },
          },
        ],
      },
    ],
    max_tokens: 300,
    temperature: 0,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("La IA no detectó placa en la imagen");
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const placaRaw = parseString(parsed.placa);
  const alternativaRaw = parseString(parsed.placa_alternativa);
  const confianzaRaw = parseString(parsed.confianza);

  const { placa, confianza: confianzaElegida } = elegirMejorPlaca(placaRaw, alternativaRaw);

  const confianzaExplicita =
    confianzaRaw === "alta" || confianzaRaw === "baja" ? confianzaRaw : null;

  return {
    placa,
    confianza: confianzaExplicita ?? confianzaElegida,
    placaAlternativa: alternativaRaw ? compactarPlaca(alternativaRaw) : null,
  };
}

/** Expone variantes OCR para búsqueda en flota (tests / server). */
export { generarVariantesOcrPlaca } from "@/lib/vehicles/placa";
