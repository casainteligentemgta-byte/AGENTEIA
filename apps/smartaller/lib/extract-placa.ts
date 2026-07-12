import {
  createOpenAIClient,
  getVisionModelId,
} from "@/lib/ai/openai-config";
import {
  compactarPlaca,
  esPlacaPlausible,
  generarVariantesOcrPlaca,
  puntajeEspecificidadPlaca,
} from "@/lib/vehicles/placa";

export type ContextoFotoPlaca = "frontal" | "placa";

export type PlacaExtraida = {
  placa: string | null;
  confianza: "alta" | "baja" | null;
  /** Placa alternativa si la IA duda entre dos lecturas */
  placaAlternativa?: string | null;
};

const FORMATOS_PLACA = `Formatos frecuentes (lee de izquierda a derecha, carácter por carácter):
- Colombia: ABC123 (3 letras + 3 números)
- Venezuela / caribe: AA90N90 (2 letras + 2 números + 1 letra + 2 números). Ejemplo real: AA90N90
- Motos Colombia: AB123C o ABC12D
- Antiguas: AB1234, 123ABC`;

const REGLAS_OCR = `REGLAS ESTRICTAS:
- Lee SOLO la placa oficial (lámina metálica o acrílica).
- IGNORA: VIN, chasis, stickers, concesionario, marca, parabrisas, decoración.
- Distingue bien: O vs 0, I vs 1, Z vs 2, S vs 5, B vs 8, N vs M, G vs 6.
- Si la placa no se lee con claridad, devuelve placa: null (no inventes).`;

const PROMPTS: Record<ContextoFotoPlaca, string> = {
  frontal: `Eres un experto leyendo placas vehiculares en Colombia y Venezuela (LATAM).
La imagen es una foto FRONTAL del vehículo (frente / parachoques / portaplacas).

${FORMATOS_PLACA}

${REGLAS_OCR}
- En placas tipo AA90N90: la letra central (ej. N) va ENTRE números; no la confundas con 0 ni M.

Responde SOLO JSON:
{
  "placa": "texto exacto o null",
  "confianza": "alta" | "baja" | null,
  "placa_alternativa": "otra lectura posible o null",
  "motivo": "breve: dónde viste la placa o por qué es null"
}`,

  placa: `Eres un experto leyendo placas vehiculares en Colombia y Venezuela (LATAM).
La imagen es un primer plano de la placa/matrícula.

${FORMATOS_PLACA}

${REGLAS_OCR}
- Transcribe EXACTAMENTE los caracteres visibles, sin espacios ni guiones.

Responde SOLO JSON:
{
  "placa": "texto exacto o null",
  "confianza": "alta" | "baja" | null,
  "placa_alternativa": "otra lectura o null"
}`,
};

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

/** Patrones con estructura fija (no fallback genérico). */
const PATRON_ESPECIFICO_MINIMO = 3;

function elegirMejorPlaca(
  principal: string | null,
  alternativa: string | null
): { placa: string | null; confianza: "alta" | "baja" | null } {
  const rawCandidatos = [principal, alternativa]
    .filter((p): p is string => Boolean(p))
    .map(compactarPlaca);

  const candidatos = [...new Set(rawCandidatos)]
    .filter(esPlacaPlausible)
    .sort((a, b) => puntajeEspecificidadPlaca(b) - puntajeEspecificidadPlaca(a));

  if (candidatos.length === 0) {
    const fallback = principal ? compactarPlaca(principal) : null;
    if (fallback && fallback.length >= 5 && fallback.length <= 8) {
      return { placa: fallback, confianza: "baja" };
    }
    return { placa: null, confianza: null };
  }

  const mejor = candidatos[0];
  const plausiblePrincipal =
    principal && esPlacaPlausible(compactarPlaca(principal));
  const altaEspecificidad = puntajeEspecificidadPlaca(mejor) >= PATRON_ESPECIFICO_MINIMO;

  return {
    placa: mejor,
    confianza: plausiblePrincipal && altaEspecificidad ? "alta" : "baja",
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
