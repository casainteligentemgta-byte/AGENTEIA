/** Si el OCR no responde, se desbloquea la UI y la lectura sigue en segundo plano. */
export const OCR_UI_UNLOCK_MS = 40_000;

/** Errores de red típicos (Safari iOS: "Load failed") al llamar Server Actions. */
export function isCargaMasivaNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /Load failed|Failed to fetch|NetworkError|network error|fetch failed|The network connection was lost|timeout|aborted/i.test(
    msg
  );
}

export function formatCargaMasivaClientError(err: unknown): string {
  if (isCargaMasivaNetworkError(err)) {
    return "Falló la conexión al procesar el PDF (límite de red o archivo grande). Reintenta; si persiste, usa un PDF más liviano (< 8 MB) o Wi‑Fi estable.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Error inesperado al procesar la carga masiva";
}

export type CargaMasivaStorageDocRef = {
  path: string;
  tipo: "factura_comercial" | "bl_guia" | "certificado_origen";
  fileName: string;
};

/** Nombre seguro para Storage (sin path traversal). */
export function safeStorageFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "documento.pdf";
  return base.slice(0, 120);
}
