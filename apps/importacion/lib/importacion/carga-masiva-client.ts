/** Si el OCR no responde, se desbloquea la UI y la lectura sigue en segundo plano. */
export const OCR_UI_UNLOCK_MS = 40_000;

/** Errores de red típicos (Safari iOS: "Load failed") al llamar Server Actions. */
export function isCargaMasivaNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /Load failed|Failed to fetch|NetworkError|network error|fetch failed|The network connection was lost|timeout|aborted/i.test(
    msg
  );
}

/** Tras un deploy, el JS viejo llama Server Actions que ya no existen (404 vacío). */
export function isStaleDeployOcrError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /404.*status code \(no body\)|Failed to find Server Action|Invalid Server Action request/i.test(
    msg
  );
}

export function formatCargaMasivaClientError(err: unknown): string {
  if (isStaleDeployOcrError(err)) {
    return "La página quedó desactualizada tras el deploy (404). Recarga sin caché (en el móvil: cerrar pestaña y abrir de nuevo) y vuelve a Extraer vehículos.";
  }
  if (isCargaMasivaNetworkError(err)) {
    return "Falló la conexión al procesar el PDF (límite de red o archivo grande). Reintenta; si persiste, usa un PDF más liviano (< 8 MB) o Wi‑Fi estable.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Error inesperado al procesar la carga masiva";
}

/**
 * POST a Route Handler (120s, URL estable). Si la ruta no está en ese deploy, cae a Server Action.
 */
export async function postSmartimportOcr<T>(
  path: "/api/smartimport/ocr-documento" | "/api/smartimport/ocr-carga-masiva",
  fd: FormData,
  fallback: (fd: FormData) => Promise<T>
): Promise<T> {
  try {
    const res = await fetch(path, {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (res.status === 404) {
      return fallback(fd);
    }
    const text = await res.text();
    if (!text.trim()) {
      return fallback(fd);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback(fd);
    }
  } catch {
    return fallback(fd);
  }
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
