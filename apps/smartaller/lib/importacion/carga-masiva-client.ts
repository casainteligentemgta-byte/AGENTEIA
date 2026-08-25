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
    return "Se cortó la conexión al leer el PDF (en el móvil el OCR puede tardar). Reintenta con Wi‑Fi; si usas varios certificados, súbelos de uno en uno.";
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Error inesperado al procesar la carga masiva";
}

async function postOcrOnce<T>(
  path: "/api/smartimport/ocr-documento" | "/api/smartimport/ocr-carga-masiva",
  fd: FormData,
  fallback: (fd: FormData) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    body: fd,
    credentials: "include",
    signal,
  });
  if (res.status === 404) {
    return fallback(fd);
  }
  if (res.status === 413) {
    throw new Error(
      "El PDF supera el límite del servidor. Usa un archivo más liviano (< 8 MB)."
    );
  }
  const text = await res.text();
  if (!text.trim()) {
    if (res.ok) return fallback(fd);
    throw new Error("El servidor no respondió al OCR. Reintenta.");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback(fd);
  }
}

/**
 * POST a Route Handler (120s, URL estable).
 * Solo cae a Server Action si la ruta no existe en ese deploy (404 / cuerpo vacío).
 * Un fallo de red no debe usar Server Action: en móvil suele cortarse antes.
 */
export async function postSmartimportOcr<T>(
  path: "/api/smartimport/ocr-documento" | "/api/smartimport/ocr-carga-masiva",
  fd: FormData,
  fallback: (fd: FormData) => Promise<T>,
  options?: { signal?: AbortSignal; deadlineMs?: number }
): Promise<T> {
  const deadlineMs = options?.deadlineMs;
  const signal =
    options?.signal ??
    (deadlineMs && deadlineMs > 0 ? AbortSignal.timeout(deadlineMs) : undefined);
  try {
    return await postOcrOnce(path, fd, fallback, signal);
  } catch (first) {
    if (signal?.aborted) {
      throw new Error(
        "El OCR tardó demasiado (límite del servidor). Reintenta con Wi‑Fi o un PDF más liviano; si ya hay filas, se conservan."
      );
    }
    if (isCargaMasivaNetworkError(first)) {
      try {
        return await postOcrOnce(path, fd, fallback, signal);
      } catch {
        throw first;
      }
    }
    throw first;
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
