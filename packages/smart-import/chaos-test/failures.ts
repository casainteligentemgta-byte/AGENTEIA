/**
 * Inyectores de fallos para chaos tests (sin Testcontainers).
 */
export type FailureHandle = { restore: () => void | Promise<void> };

export function injectNetworkDelay(ms: number): FailureHandle {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    await new Promise((r) => setTimeout(r, ms));
    return original(input, init);
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

export function injectDatabaseSlowness(
  fn: (...args: unknown[]) => Promise<unknown>,
  ms: number
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]) => {
    await new Promise((r) => setTimeout(r, ms));
    return fn(...args);
  };
}

export function injectDiskFull(thresholdPercent = 95): {
  isCritical: (usedPercent: number) => boolean;
  message: string;
} {
  return {
    isCritical: (usedPercent: number) => usedPercent >= thresholdPercent,
    message: "Disk space critical",
  };
}

export function injectMemoryPressure(targetBytes: number): {
  allocate: () => Buffer;
  release: (buf: Buffer | null) => void;
} {
  let hold: Buffer | null = null;
  return {
    allocate: () => {
      hold = Buffer.alloc(targetBytes);
      return hold;
    },
    release: () => {
      hold = null;
    },
  };
}

export function disconnectService(state: { connected: boolean }): FailureHandle {
  state.connected = false;
  return {
    restore: () => {
      state.connected = true;
    },
  };
}

export function timeoutRandomRequests(
  percentage: number
): (roll?: number) => boolean {
  const p = Math.min(1, Math.max(0, percentage));
  return (roll = Math.random()) => roll < p;
}

export async function withFailure<T>(
  handle: FailureHandle,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } finally {
    await handle.restore();
  }
}
