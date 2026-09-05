import { normalizePlaca } from "@/lib/format";
import { parseCodigoExpediente, placaRealVisible } from "@/lib/importacion/expediente";

/** Docs que el INTT entrega tras presentar el archivo (fase 8). */
export const ENTREGA_PLACA_TIPOS = [
  "documento_circulacion",
  "placa_pdf",
  "titulo",
  "rcv_seguro",
  "tarjeta_circulacion",
] as const;

export type EntregaPlacaDocs = Partial<
  Record<(typeof ENTREGA_PLACA_TIPOS)[number], { url?: string | null } | null>
>;

export function docsEntregaPlacaListos(
  docs: EntregaPlacaDocs | null | undefined
): boolean {
  if (!docs) return false;
  return ENTREGA_PLACA_TIPOS.every((tipo) => Boolean(docs[tipo]?.url));
}

/** Documentos de circulación + placa vehicular real (única, no el expediente). */
export function esEntregaPlacaCompleta(
  docs: EntregaPlacaDocs | null | undefined,
  placa?: string | null,
  codigoExpediente?: string | null
): boolean {
  if (!docsEntregaPlacaListos(docs)) return false;
  return Boolean(placaRealVisible(placa, codigoExpediente));
}

export function validarPlacaVehicular(
  raw: string | null | undefined,
  codigoExpediente?: string | null
): { ok: true; placa: string } | { ok: false; error: string } {
  const placa = normalizePlaca(raw ?? "");
  if (!placa) {
    return { ok: false, error: "Indica la placa vehicular (número único)." };
  }
  if (parseCodigoExpediente(placa)) {
    return {
      ok: false,
      error: "La placa no puede ser el número de expediente (PL-Año.Mes.N).",
    };
  }
  if (!placaRealVisible(placa, codigoExpediente)) {
    return { ok: false, error: "Ingresa un número de placa válido." };
  }
  return { ok: true, placa };
}
