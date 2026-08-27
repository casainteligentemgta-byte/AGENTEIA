export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export type CircuitBreakerConfig = {
  failureThreshold?: number;
  resetTimeoutMs?: number;
  monitorInterval?: number;
};

export type CircuitBreakerMetrics = {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  name: string;
};

/**
 * Circuit breaker: CLOSED → OPEN tras N fallos; HALF_OPEN tras timeout.
 */
export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(name: string, config: CircuitBreakerConfig = {}) {
    this.name = name;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 30_000;
  }

  getState(): CircuitState {
    return this.state;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (
        this.lastFailureTime != null &&
        now - this.lastFailureTime > this.resetTimeoutMs
      ) {
        this.state = CircuitState.HALF_OPEN;
        console.log("🔌 CircuitBreaker HALF_OPEN, probando...");
      } else {
        throw new Error(`CircuitBreaker is OPEN (${this.name})`);
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      try {
        const result = await fn();
        this.failureCount = 0;
        this.state = CircuitState.CLOSED;
        this.lastFailureTime = null;
        console.log("🔌 CircuitBreaker CLOSED");
        return result;
      } catch (err) {
        this.failureCount += 1;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.failureThreshold) {
          this.state = CircuitState.OPEN;
          console.log("🔌 CircuitBreaker OPEN");
        } else {
          this.state = CircuitState.OPEN;
          console.log("🔌 CircuitBreaker OPEN");
        }
        throw err;
      }
    }

    // CLOSED
    try {
      return await fn();
    } catch (err) {
      this.failureCount += 1;
      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.lastFailureTime = Date.now();
        console.log("🔌 CircuitBreaker OPEN, threshold alcanzado");
      }
      throw err;
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = null;
    console.log("🔌 CircuitBreaker RESET");
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      name: this.name,
    };
  }
}
