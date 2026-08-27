export type ShutdownConfig = {
  timeoutMs?: number;
  onShutdown?: () => Promise<void>;
  /** Solo tests: inyectar sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Solo tests: reloj. */
  now?: () => number;
};

/**
 * Espera importaciones activas antes de apagar el proceso.
 */
export class GracefulShutdown {
  private readonly activeImports = new Set<string>();
  private shuttingDown = false;

  registerImport(importId: string): void {
    this.activeImports.add(importId);
  }

  unregisterImport(importId: string): void {
    this.activeImports.delete(importId);
  }

  getActiveCount(): number {
    return this.activeImports.size;
  }

  async shutdown(config: ShutdownConfig = {}): Promise<void> {
    const timeoutMs = config.timeoutMs ?? 30_000;
    const sleep =
      config.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    const now = config.now ?? (() => Date.now());

    this.shuttingDown = true;
    console.log("🛑 Iniciando graceful shutdown...");

    if (this.activeImports.size > 0) {
      console.log(
        `⏳ Esperando ${this.activeImports.size} importaciones en curso`
      );
      const deadline = now() + timeoutMs;
      while (this.activeImports.size > 0 && now() < deadline) {
        console.log(
          `⏳ Aún esperando: ${this.activeImports.size} activas`
        );
        await sleep(Math.min(1000, Math.max(0, deadline - now())));
      }
      if (this.activeImports.size > 0) {
        console.warn(
          `⚠️  Timeout de shutdown: ${this.activeImports.size} importación(es) aún activas`
        );
      }
    }

    if (config.onShutdown) {
      await config.onShutdown();
    }

    console.log("✅ Shutdown completado");
    this.shuttingDown = false;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  setupSignalHandlers(config: ShutdownConfig = {}): void {
    const handler = async (signal: string) => {
      console.log(`[smart-import] Señal ${signal} recibida`);
      try {
        await this.shutdown(config);
      } finally {
        process.exit(0);
      }
    };

    for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"] as const) {
      process.on(signal, () => {
        void handler(signal);
      });
    }
    console.log("📍 Signal handlers configurados");
  }
}

/** Singleton opcional para el servidor Express. */
export const gracefulShutdown = new GracefulShutdown();
