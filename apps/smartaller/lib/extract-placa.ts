import { createVisionJsonCompletion } from "@/lib/ai/vision-completion";
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

const FORMATOS_PLACA = `CONTEXTO: placas de Venezuela (INTT). El taller trabaja con vehículos del país y régimen Puerto Libre (PL).

Formatos Venezuela (lee de IZQUIERDA a DERECHA, carácter por carácter):
- Particulares / serial común: AA90N90 → 2 letras + 2 números + 1 letra + 2 números (7 caracteres)
- INTT clásico particulares: AB123CD → 2 letras + 3 números + 1 letra + código de estado (xx123xA)
- Puerto Libre (PL): AA90N9O → igual estructura pero el ÚLTIMO carácter es la letra O (Nueva Esparta), NO el número cero
- Motos VE: xx1x23G | PL motos: xx1234O
- La última letra en placas INTT indica el estado (A=Distrito Capital, G=Carabobo, O=Nueva Esparta/PL, etc.)

Secundario (otros países): Colombia ABC123, motos AB123C.`;

const REGLAS_OCR = `REGLAS ESTRICTAS:
- Lee SOLO la placa oficial (lámina aluminio, tricolor Venezuela, relieve negro).
- IGNORA: VIN, chasis, stickers, QR, "República Bolivariana de Venezuela", nombre del estado abajo, concesionario.
- En Venezuela el último dígito suele ser LETRA de estado: confunde mucho O (letra) con 0 (cero), sobre todo en placas PL.
- Distingue: O vs 0, I vs 1, Z vs 2, S vs 5, B vs 8, N vs M, G vs 6.
- Si la placa no se lee con claridad, devuelve placa: null (no inventes).`;

const PROMPTS: Record<ContextoFotoPlaca, string> = {
  frontal: `Eres un experto leyendo placas vehiculares de VENEZUELA (INTT y Puerto Libre / PL).
La imagen es una foto FRONTAL del vehículo (parachoques / portaplacas).

${FORMATOS_PLACA}

${REGLAS_OCR}
- Ejemplo real del taller: AA90N90 (o AA90N9O si el último parece cero pero es letra O de PL).
- La letra central (posición 5, ej. N) va ENTRE números; no la confundas con 0 ni M.

Responde SOLO JSON:
{
  "placa": "texto exacto o null",
  "confianza": "alta" | "baja" | null,
  "placa_alternativa": "otra lectura posible o null",
  "motivo": "breve: dónde viste la placa o por qué es null"
}`,

  placa: `Eres un experto leyendo placas vehiculares de VENEZUELA (INTT y Puerto Libre / PL).
La imagen es un primer plano de la placa/matrícula venezolana.

${FORMATOS_PLACA}

${REGLAS_OCR}
- Transcribe EXACTAMENTE los 7 caracteres del serial central, sin espacios ni guiones.
- Si ves "Puerto Libre" o placa de importación PL, el último carácter casi siempre es O (letra), no 0.

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
  const parsed = await createVisionJsonCompletion({
    prompt: PROMPTS[contexto],
    imageBuffer,
    mimeType,
    maxTokens: 300,
  });

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
