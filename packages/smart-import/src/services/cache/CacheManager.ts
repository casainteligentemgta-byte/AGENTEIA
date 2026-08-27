import { createHash } from "crypto";
import { createClient, type RedisClientType } from "redis";

type MemoryEntry = {
  value: string;
  expiresAt: number | null;
};

/**
 * Gestor de caché Redis con fallback en memoria si Redis no está disponible.
 * No rompe el flujo de importación cuando REDIS_* no está configurado.
 */
export class CacheManager {
  private client: RedisClientType | null = null;
  private ready = false;
  private readonly memory = new Map<string, MemoryEntry>();
  private connectPromise: Promise<void> | null = null;

  constructor() {
    const host = process.env.REDIS_HOST?.trim();
    const port = Number(process.env.REDIS_PORT?.trim() || "6379");
    const password = process.env.REDIS_PASSWORD?.trim() || undefined;
    const url = process.env.REDIS_URL?.trim();

    try {
      if (url) {
        this.client = createClient({
          url,
          socket: {
            reconnectStrategy: (retries) =>
              Math.min(1000 * 2 ** retries, 10_000),
          },
        });
      } else if (host) {
        this.client = createClient({
          socket: {
            host,
            port: Number.isFinite(port) ? port : 6379,
            reconnectStrategy: (retries) =>
              Math.min(1000 * 2 ** retries, 10_000),
          },
          password,
        });
      } else {
        console.warn(
          "[smart-import.cache] REDIS_HOST/REDIS_URL no configurados; usando memoria local"
        );
        return;
      }

      this.client.on("error", (err) => {
        console.warn("[smart-import.cache] Redis error:", err.message);
        this.ready = false;
      });
      this.client.on("connect", () => {
        console.log("[smart-import.cache] ✓ Redis conectado");
        this.ready = true;
      });

      this.connectPromise = this.client
        .connect()
        .then(() => {
          this.ready = true;
        })
        .catch((err: unknown) => {
          console.warn(
            "[smart-import.cache] No se pudo conectar a Redis; fallback memoria:",
            err instanceof Error ? err.message : err
          );
          this.client = null;
          this.ready = false;
        });
    } catch (err) {
      console.warn(
        "[smart-import.cache] Error creando cliente Redis:",
        err instanceof Error ? err.message : err
      );
      this.client = null;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.connectPromise) {
      await this.connectPromise;
      this.connectPromise = null;
    }
  }

  private generateHash(data: unknown): string {
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }

  /** Expone hash estable para claves de caché externas. */
  hash(data: unknown): string {
    return this.generateHash(data);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnected();
      if (this.client && this.ready) {
        const raw = await this.client.get(key);
        if (raw == null) return null;
        return JSON.parse(raw) as T;
      }

      const entry = this.memory.get(key);
      if (!entry) return null;
      if (entry.expiresAt != null && Date.now() > entry.expiresAt) {
        this.memory.delete(key);
        return null;
      }
      return JSON.parse(entry.value) as T;
    } catch (err) {
      console.warn(
        "[smart-import.cache] get falló:",
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl = 3600): Promise<void> {
    try {
      await this.ensureConnected();
      const payload = JSON.stringify(value);
      if (this.client && this.ready) {
        await this.client.setEx(key, ttl, payload);
        return;
      }
      this.memory.set(key, {
        value: payload,
        expiresAt: ttl > 0 ? Date.now() + ttl * 1000 : null,
      });
    } catch (err) {
      console.warn(
        "[smart-import.cache] set falló:",
        err instanceof Error ? err.message : err
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      if (this.client && this.ready) {
        await this.client.del(key);
        return;
      }
      this.memory.delete(key);
    } catch (err) {
      console.warn(
        "[smart-import.cache] delete falló:",
        err instanceof Error ? err.message : err
      );
    }
  }

  /**
   * Patrón cache-aside: lee caché o ejecuta fn y guarda el resultado.
   */
  async getOrCreate<T>(
    key: string,
    fn: () => Promise<T> | T,
    ttl = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fn();
    await this.set(key, value, ttl);
    return value;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await this.ensureConnected();
      if (this.client && this.ready) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) await this.client.del(keys);
        return;
      }
      const regex = new RegExp(
        "^" +
          pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".") +
          "$"
      );
      for (const key of [...this.memory.keys()]) {
        if (regex.test(key)) this.memory.delete(key);
      }
    } catch (err) {
      console.warn(
        "[smart-import.cache] invalidatePattern falló:",
        err instanceof Error ? err.message : err
      );
    }
  }

  async clear(): Promise<void> {
    try {
      await this.ensureConnected();
      if (this.client && this.ready) {
        await this.client.flushDb();
        return;
      }
      this.memory.clear();
    } catch (err) {
      console.warn(
        "[smart-import.cache] clear falló:",
        err instanceof Error ? err.message : err
      );
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.ensureConnected();
      if (this.client) {
        await this.client.quit();
        this.client = null;
        this.ready = false;
      }
      this.memory.clear();
    } catch (err) {
      console.warn(
        "[smart-import.cache] disconnect falló:",
        err instanceof Error ? err.message : err
      );
    }
  }

  /** Solo tests: fuerza expiración inmediata de una clave en memoria. */
  __expireMemoryKeyForTests(key: string): void {
    const entry = this.memory.get(key);
    if (entry) entry.expiresAt = Date.now() - 1;
  }

  /** Solo tests: indica si hay cliente Redis activo. */
  __isRedisReadyForTests(): boolean {
    return Boolean(this.client && this.ready);
  }
}
