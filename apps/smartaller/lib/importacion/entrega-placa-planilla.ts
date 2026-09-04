/** Foto de placa + título de propiedad (fase 8). */
export const ENTREGA_PLACA_TIPOS = ["foto_placa", "titulo"] as const;

export type EntregaPlacaDocs = Partial<
  Record<(typeof ENTREGA_PLACA_TIPOS)[number], { url?: string | null } | null>
>;

export function esEntregaPlacaCompleta(
  docs: EntregaPlacaDocs | null | undefined
): boolean {
  if (!docs) return false;
  return ENTREGA_PLACA_TIPOS.every((tipo) => Boolean(docs[tipo]?.url));
}
