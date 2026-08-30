/** Si el OCR no responde, se desbloquea la UI y la lectura sigue en segundo plano. */
export const OCR_UI_UNLOCK_MS = 40_000;

const OCR_ATTEMPTS = 3;
/** VIN puede tardar; certs es texto. Más de esto = job colgado, no seguir bloqueando. */
const OCR_POLL_MS = 90_000;
const OCR_SAVED_JOB_MS = 12_000;
const OCR_POLL_EVERY_MS = 2000;

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
  const raw = (
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err == null
          ? ""
          : String(err)
  ).trim();
  if (/application\/json/i.test(raw) && /not supported|unsupported mime/i.test(raw)) {
    return "No se pudo leer el documento: el celular lo etiquetó mal. Cerrá la pestaña, abrí de nuevo y tocá Procesar. Si sigue, usá una foto en vez del PDF.";
  }
  if (raw && raw !== "undefined" && raw !== "null" && raw !== "[object Object]") {
    return raw;
  }
  return "Error inesperado al procesar la carga masiva";
}

function rethrowOcrError(err: unknown, fallback: string): never {
  if (err instanceof Error) throw err;
  throw new Error(typeof err === "string" && err.trim() ? err : fallback);
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
  /** Tope de espera del job en segundo plano. */
  pollMs?: number;
  onRetry?: (attempt: number, total: number) => void;
};

export function isOcrPollTimeoutError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /dejó de esperar|puede seguir leyendo/i.test(msg);
}

function isPendingOcrJob(value: unknown): value is { pending: true; jobId: string } {
  if (!value || typeof value !== "object") return false;
  const o = value as { pending?: unknown; jobId?: unknown };
  return o.pending === true && typeof o.jobId === "string" && o.jobId.length > 8;
}

function cargaJobStorageKey(fd: FormData): string {
  return `st-ocr-job:${String(fd.get("etapa") ?? "")}:${String(fd.get("storageDocs") ?? "")}`;
}

function readSavedJobId(fd: FormData): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const id = sessionStorage.getItem(cargaJobStorageKey(fd));
    return id && id.length > 8 ? id : null;
  } catch {
    return null;
  }
}

function saveJobId(fd: FormData, jobId: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(cargaJobStorageKey(fd), jobId);
  } catch {
    /* private mode */
  }
}

function clearJobId(fd: FormData): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(cargaJobStorageKey(fd));
  } catch {
    /* ignore */
  }
}

async function pollOcrJob<T>(
  path: "/api/smartimport/ocr-carga-masiva",
  jobId: string,
  options?: PostSmartimportOcrOptions
): Promise<T> {
  const started = Date.now();
  const limitMs = options?.pollMs ?? OCR_POLL_MS;
  const totalTicks = Math.ceil(limitMs / OCR_POLL_EVERY_MS);
  let tick = 0;
  while (Date.now() - started < limitMs) {
    tick += 1;
    options?.onRetry?.(tick, totalTicks);
    try {
      const res = await fetch(`${path}?job=${encodeURIComponent(jobId)}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: timeoutSignal(15_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          status?: string;
          result?: T;
          error?: string | null;
        };
        if (data.status === "done" && data.result) return data.result;
        if (data.status === "error") {
          if (data.result) return data.result;
          throw new Error(data.error || "El OCR falló");
        }
      }
    } catch (err) {
      if (isAbortError(err) || isCargaMasivaNetworkError(err)) {
        await sleep(OCR_POLL_EVERY_MS);
        continue;
      }
      throw err;
    }
    await sleep(OCR_POLL_EVERY_MS);
  }
  throw new Error(
    "El celular dejó de esperar, pero el servidor puede seguir leyendo. Vuelve a tocar Procesar en unos segundos; si ya hay filas, se conservan."
  );
}

/**
 * POST a Route Handler. Carga masiva: el servidor trabaja en segundo plano y el
 * celular solo consulta el estado (peticiones cortas, aptas para LTE/Safari).
 */
export async function postSmartimportOcr<T>(
  path: "/api/smartimport/ocr-documento" | "/api/smartimport/ocr-carga-masiva",
  fd: FormData,
  fallback: (fd: FormData) => Promise<T>,
  options?: PostSmartimportOcrOptions
): Promise<T> {
  if (path === "/api/smartimport/ocr-carga-masiva") {
    const savedId = readSavedJobId(fd);
    if (savedId) {
      try {
        const existing = await pollOcrJob<T>(path, savedId, {
          ...options,
          pollMs: Math.min(options?.pollMs ?? OCR_SAVED_JOB_MS, OCR_SAVED_JOB_MS),
        });
        clearJobId(fd);
        return existing;
      } catch {
        clearJobId(fd);
      }
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(path, {
          method: "POST",
          body: cloneFormData(fd),
          credentials: "include",
          signal: timeoutSignal(20_000),
        });
        if (res.status === 404) return fallback(fd);
        if (res.status === 413) {
          throw new Error(
            "El PDF supera el límite del servidor. Usa un archivo más liviano (< 8 MB)."
          );
        }
        const text = await res.text();
        if (!text.trim()) {
          throw new Error("El servidor no respondió al OCR. Reintenta.");
        }
        let data: unknown;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error("El servidor no respondió al OCR. Reintenta.");
        }
        if (isPendingOcrJob(data)) {
          saveJobId(fd, data.jobId);
          const result = await pollOcrJob<T>(path, data.jobId, options);
          clearJobId(fd);
          return result;
        }
        return data as T;
      } catch (err) {
        lastError = err;
        const retryable = isAbortError(err) || isCargaMasivaNetworkError(err);
        if (!retryable || attempt >= 3) break;
        options?.onRetry?.(attempt + 1, 3);
        await sleep(700 * attempt);
      }
    }
    if (isAbortError(lastError)) {
      throw new Error(
        "No se pudo iniciar el OCR en datos móviles. Vuelve a tocar Procesar."
      );
    }
    rethrowOcrError(lastError, "El servidor no respondió al OCR. Reintenta.");
  }

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
  rethrowOcrError(lastError, "El servidor no respondió al OCR. Reintenta.");
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
