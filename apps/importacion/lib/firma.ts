/** Firma guardada como data URL de imagen (canvas). */
export function isFirmaImagen(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("data:image/"));
}
