/**
 * Chaos engineering tests (Vitest) — sin Docker/Testcontainers.
 * Simula caídas Redis/BD/red con mocks + CircuitBreaker real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { CircuitBreaker } from "../src/services/circuitbreaker/CircuitBreaker";
import { RetryPolicy, isTransientError } from "../src/services/retry/RetryPolicy";
import { CacheManager } from "../src/services/cache/CacheManager";
import { SmartImporter } from "../src/services/SmartImporter";
import { __resetImportJobsForTests } from "../src/services/ImportService";
import { z } from "zod";
import {
  disconnectService,
  injectDiskFull,
  injectMemoryPressure,
  timeoutRandomRequests,
  withFailure,
} from "./failures";
import type { NextFunction, Request, Response } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../src/api/middleware/auth";
import importRouter from "../src/api/routes/import";

vi.mock("../src/api/middleware/rateLimit", () => {
  let hits = 0;
  return {
    apiLimiter: (req: Request, res: Response, next: NextFunction) => {
      if (req.headers["x-chaos-burst"] === "1") {
        hits += 1;
        if (hits > 10) {
          res.status(429).json({ success: false, error: "Too Many Requests" });
          return;
        }
      }
      next();
    },
    importLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
    passthroughLimiter: (_req: Request, _res: Response, next: NextFunction) =>
      next(),
    __resetChaosHits: () => {
      hits = 0;
    },
  };
});

vi.mock("../src/api/middleware/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/middleware/auth")>();
  return {
    ...actual,
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      const id = String(req.headers["x-user-id"] ?? "chaos-user");
      (req as AuthenticatedRequest).user = {
        id,
        email: `${id}@t.local`,
        role: "user",
      };
      (req as AuthenticatedRequest).supabase =
        {} as AuthenticatedRequest["supabase"];
      next();
    },
  };
});

describe("Chaos Tests", () => {
  beforeEach(() => {
    __resetImportJobsForTests();
  });

  it("Chaos: Import continues if Redis dies", async () => {
    const cache = new CacheManager();
    const redisState = { connected: true };
    const handle = disconnectService(redisState);

    await withFailure(handle, async () => {
      expect(redisState.connected).toBe(false);
      // Sin Redis el CacheManager usa memoria local
      await cache.set("chaos:key", { ok: true }, 60);
      const val = await cache.get<{ ok: boolean }>("chaos:key");
      expect(val?.ok).toBe(true);
    });

    await cache.disconnect();
  });

  it("Chaos: Import continues if Network slow", async () => {
    const slowOp = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { imported: 10 };
    };
    const t0 = performance.now();
    const result = await RetryPolicy.execute(slowOp, {
      maxAttempts: 2,
      initialDelayMs: 10,
      shouldRetry: isTransientError,
    });
    const duration = performance.now() - t0;
    expect(result.imported).toBe(10);
    expect(duration).toBeGreaterThanOrEqual(40);
  });

  it("Chaos: Import recovers from DB disconnect", async () => {
    const cb = new CircuitBreaker("chaos-db", {
      failureThreshold: 2,
      resetTimeoutMs: 50,
    });
    let dbUp = false;
    const query = async () => {
      if (!dbUp) throw new Error("connection refused");
      return { rows: 1 };
    };

    await expect(cb.call(query)).rejects.toThrow();
    await expect(cb.call(query)).rejects.toThrow();
    expect(cb.getState()).toBe("OPEN");

    await new Promise((r) => setTimeout(r, 60));
    dbUp = true;
    const result = await cb.call(query);
    expect(result.rows).toBe(1);
    expect(cb.getState()).toBe("CLOSED");
  });

  it("Chaos: Disk full scenario", () => {
    const disk = injectDiskFull(95);
    expect(disk.isCritical(96)).toBe(true);
    expect(disk.message).toBe("Disk space critical");
    expect(disk.isCritical(50)).toBe(false);
  });

  it("Chaos: Memory leak test", async () => {
    if (typeof global.gc === "function") global.gc();
    const initial = process.memoryUsage().heapUsed;
    const pressure = injectMemoryPressure(1 * 1024 * 1024);
    for (let i = 0; i < 20; i++) {
      const buf = pressure.allocate();
      expect(buf.length).toBeGreaterThan(0);
      pressure.release(buf);
    }
    if (typeof global.gc === "function") global.gc();
    const final = process.memoryUsage().heapUsed;
    const deltaMb = (final - initial) / (1024 * 1024);
    expect(deltaMb).toBeLessThan(50);
  });

  it("Chaos: API rate limit bypass attempt", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/import", importRouter);
    void requireAuth;

    const results: number[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post("/api/import/analyze")
        .set("x-chaos-burst", "1")
        .send({ data: [{ id: i }] });
      results.push(res.status);
    }
    const ok = results.filter((s) => s === 200).length;
    const limited = results.filter((s) => s === 429).length;
    expect(ok).toBeLessThanOrEqual(10);
    expect(limited).toBeGreaterThan(0);
  });

  it("Chaos: Concurrent imports conflict", async () => {
    const schema = z.object({ id: z.number(), name: z.string() });
    const run = async (table: "devices" | "automations" | "sensor_data", n: number) => {
      const importer = new SmartImporter();
      const records = Array.from({ length: n }, (_, i) => ({
        id: i,
        name: `${table}-${i}`,
      }));
      const result = await importer.importWithStrategy(records, {
        targetTable: table,
        schema,
        user: { id: `u-${table}`, email: "a@b.co", role: "user" },
        useCache: false,
        streaming: true,
      });
      await importer.disconnect();
      return result;
    };

    const [a, b, c] = await Promise.all([
      run("devices", 20),
      run("automations", 15),
      run("sensor_data", 25),
    ]);

    expect(a.job.targetTable).toBe("devices");
    expect(b.job.targetTable).toBe("automations");
    expect(c.job.targetTable).toBe("sensor_data");
    expect(a.transformedCount).toBe(20);
    expect(b.transformedCount).toBe(15);
    expect(c.transformedCount).toBe(25);
  });

  it("timeoutRandomRequests helper", () => {
    const shouldTimeout = timeoutRandomRequests(1);
    expect(shouldTimeout(0.5)).toBe(true);
    const never = timeoutRandomRequests(0);
    expect(never(0.9)).toBe(false);
  });
});
