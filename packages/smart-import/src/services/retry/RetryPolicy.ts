export type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
  /** Solo tests: inyectar delays capturados. */
  sleep?: (ms: number) => Promise<void>;
};

const DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
} as const;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reintentos con backoff exponencial + jitter (~10%).
 */
export class RetryPolicy {
  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxAttempts = options.maxAttempts ?? DEFAULTS.maxAttempts;
    const initialDelayMs = options.initialDelayMs ?? DEFAULTS.initialDelayMs;
    const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
    const backoffMultiplier =
      options.backoffMultiplier ?? DEFAULTS.backoffMultiplier;
    const shouldRetry = options.shouldRetry ?? (() => true);
    const sleep = options.sleep ?? defaultSleep;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;

        const isLast = attempt >= maxAttempts;
        if (!shouldRetry(error) || isLast) {
          throw error;
        }

        let delayMs =
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        delayMs = Math.min(delayMs, maxDelayMs);
        const jitter = Math.random() * 0.1 * delayMs;
        const totalDelay = delayMs + jitter;

        options.onRetry?.(attempt, error);
        console.log(
          `⏳ Reintentando en ${Math.round(totalDelay)}ms (intento ${attempt}/${maxAttempts})`
        );
        await sleep(totalDelay);
      }
    }

    throw lastError ?? new Error("RetryPolicy: sin intentos");
  }
}

/** Errores típicamente transientes (red / 5xx / timeout). */
export function isTransientError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return (
    /timeout|econnreset|econnrefused|etimedout|503|502|504|temporar|network|fetch failed/.test(
      msg
    ) || error.name === "AbortError"
  );
}
