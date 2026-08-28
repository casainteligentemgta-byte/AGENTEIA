/** Si el OCR no responde, se desbloquea la UI y la lectura sigue en segundo plano. */
export const OCR_UI_UNLOCK_MS = 40_000;

const OCR_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cloneFormData(fd: FormData): FormData {
  const next = new FormData();
  fd.forEach((value, key) => {
    next.append(key, value);
  });
  return next;
}

function timeoutSignal(ms: number | undefined): AbortSignal | undefined {
  if (!ms || ms <= 0) return undefined;
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  const msg = "message" in err ? String(err.message) : String(err);
  return name === "AbortError" || name === "TimeoutError" || /aborted|timeout/i.test(msg);
}

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
  if (isCargaMasivaNetworkError(err) || isAbortError(err)) {
    return "Se cortó la conexión de datos al leer el PDF. Vuelve a tocar Procesar; si ya hay filas, se conservan.";
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

export type PostSmartimportOcrOptions = {
  signal?: AbortSignal;
  deadlineMs?: number;
  attempts?: number;
  onRetry?: (attempt: number, total: number) => void;
};

/**
 * POST a Route Handler (hasta 300s). En datos móviles Safari suele cortar a ~60s:
 * reintenta la etapa sin pedir Wi‑Fi.
 */
export async function postSmartimportOcr<T>(
  path: "/api/smartimport/ocr-documento" | "/api/smartimport/ocr-carga-masiva",
  fd: FormData,
  fallback: (fd: FormData) => Promise<T>,
  options?: PostSmartimportOcrOptions
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? OCR_ATTEMPTS);
  const deadlineMs = options?.deadlineMs;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const signal = options?.signal ?? timeoutSignal(deadlineMs);
    try {
      return await postOcrOnce(path, cloneFormData(fd), fallback, signal);
    } catch (err) {
      lastError = err;
      const retryable = isAbortError(err) || isCargaMasivaNetworkError(err);
      if (!retryable || attempt >= attempts) break;
      options?.onRetry?.(attempt + 1, attempts);
      await sleep(700 * attempt);
    }
  }

  if (isAbortError(lastError)) {
    throw new Error(
      "El OCR tardó demasiado en datos móviles. Se reintentó solo; vuelve a tocar Procesar si hace falta. Si ya hay filas, se conservan."
    );
  }
  throw lastError;
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
