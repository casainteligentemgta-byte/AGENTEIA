export type UploadActionResult =
  | { success: true }
  | { success: false; error: string };

/** Evita `undefined is not an object (evaluating 'c.success')` si la action no responde. */
export function messageFromUploadResult(
  result: UploadActionResult | null | undefined
): string | null {
  if (result == null) {
    return "No se pudo subir la foto. Prueba de nuevo con una imagen más liviana.";
  }
  if (!result.success) {
    return result.error.trim() || "No se pudo subir el archivo";
  }
  return null;
}
