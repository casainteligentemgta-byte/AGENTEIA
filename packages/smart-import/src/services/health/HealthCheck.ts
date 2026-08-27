import type { SupabaseClient } from "@supabase/supabase-js";
import type { RedisClientType } from "redis";
import { statfs } from "fs/promises";

export type ComponentStatus = "up" | "down";

export type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  database: { status: ComponentStatus; latency?: number; error?: string };
  redis: { status: ComponentStatus; latency?: number; error?: string };
  memory: { usage: number; percentage: number; total: number };
  disk: { free: number; total: number; percentage: number };
  uptime: number;
  timestamp: Date;
};

type RedisLike = {
  ping: () => Promise<unknown>;
};

/**
 * Health checks de BD, Redis, memoria y disco.
 */
export class HealthCheck {
  private readonly supabase: SupabaseClient | null;
  private readonly redis: RedisLike | null;
  private readonly startTime = Date.now();
  private lastStatus: HealthStatus | null = null;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    supabase: SupabaseClient | null = null,
    redis: RedisClientType | RedisLike | null = null
  ) {
    this.supabase = supabase;
    this.redis = redis;
  }

  async check(): Promise<HealthStatus> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();
    const memory = this.checkMemory();
    const disk = await this.checkDisk();
    const uptime = (Date.now() - this.startTime) / 1000;

    let status: HealthStatus["status"] = "healthy";
    if (database.status === "down" || redis.status === "down") {
      status = "unhealthy";
    } else if (memory.percentage > 90 || disk.percentage > 90) {
      // disk.percentage = used %
      status = "degraded";
    } else if (disk.free / Math.max(disk.total, 1) < 0.1) {
      status = "degraded";
    }

    const result: HealthStatus = {
      status,
      database,
      redis,
      memory,
      disk,
      uptime,
      timestamp: new Date(),
    };
    this.lastStatus = result;
    return result;
  }

  private async checkDatabase(): Promise<HealthStatus["database"]> {
    if (!this.supabase) {
      return { status: "down", error: "Supabase no configurado" };
    }
    const t0 = performance.now();
    try {
      const { error } = await this.supabase
        .from("devices")
        .select("id")
        .limit(1);
      const latency = performance.now() - t0;
      if (error) {
        return { status: "down", latency, error: error.message };
      }
      return { status: "up", latency };
    } catch (err) {
      return {
        status: "down",
        latency: performance.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async checkRedis(): Promise<HealthStatus["redis"]> {
    if (!this.redis) {
      return { status: "down", error: "Redis no configurado" };
    }
    const t0 = performance.now();
    try {
      await this.redis.ping();
      return { status: "up", latency: performance.now() - t0 };
    } catch (err) {
      return {
        status: "down",
        latency: performance.now() - t0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private checkMemory(): HealthStatus["memory"] {
    const mem = process.memoryUsage();
    const usage = Math.round(mem.heapUsed / 1024 / 1024);
    const total = Math.round(mem.heapTotal / 1024 / 1024);
    const percentage =
      total > 0 ? (mem.heapUsed / mem.heapTotal) * 100 : 0;
    return { usage, total, percentage };
  }

  private async checkDisk(): Promise<HealthStatus["disk"]> {
    try {
      const stats = await statfs("/");
      const total = Number(stats.blocks) * Number(stats.bsize);
      const free = Number(stats.bfree) * Number(stats.bsize);
      const used = total - free;
      const percentage = total > 0 ? (used / total) * 100 : 0;
      return {
        free: Math.round(free / 1024 / 1024),
        total: Math.round(total / 1024 / 1024),
        percentage,
      };
    } catch {
      return { free: 0, total: 0, percentage: 0 };
    }
  }

  startMonitoring(intervalMs = 30_000): void {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    this.monitorTimer = setInterval(() => {
      void (async () => {
        const status = await this.check();
        if (status.status !== "healthy") {
          console.warn("⚠️  Health Check falló:", status.status, {
            database: status.database.status,
            redis: status.redis.status,
            memoryPct: status.memory.percentage.toFixed(1),
          });
        }
      })();
    }, intervalMs);
    // Evita mantener el proceso vivo solo por el monitor en tests.
    if (typeof this.monitorTimer.unref === "function") {
      this.monitorTimer.unref();
    }
    console.log(`🏥 Health Check iniciado cada ${intervalMs}ms`);
  }

  stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
  }

  getStatus(): HealthStatus {
    if (!this.lastStatus) {
      return {
        status: "degraded",
        database: { status: "down", error: "Sin chequeo previo" },
        redis: { status: "down", error: "Sin chequeo previo" },
        memory: this.checkMemory(),
        disk: { free: 0, total: 0, percentage: 0 },
        uptime: (Date.now() - this.startTime) / 1000,
        timestamp: new Date(),
      };
    }
    return this.lastStatus;
  }
}
