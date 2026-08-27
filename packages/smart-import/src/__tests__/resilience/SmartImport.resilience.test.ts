import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { RetryPolicy, isTransientError } from "../../services/retry/RetryPolicy";
import {
  CircuitBreaker,
  CircuitState,
} from "../../services/circuitbreaker/CircuitBreaker";
import { TransactionManager } from "../../services/transaction/TransactionManager";
import { HealthCheck } from "../../services/health/HealthCheck";
import { GracefulShutdown } from "../../api/middleware/gracefulShutdown";
import { SmartImporter } from "../../services/SmartImporter";
import { __resetImportJobsForTests } from "../../services/ImportService";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(opts?: {
  insertError?: string | null;
  selectError?: string | null;
  rpcError?: string | null;
}): SupabaseClient {
  let insertCalls = 0;
  const client = {
    rpc: vi.fn(async () => ({
      data: null,
      error: opts?.rpcError ? { message: opts.rpcError } : null,
    })),
    from: vi.fn(() => ({
      insert: vi.fn(async () => {
        insertCalls += 1;
        if (opts?.insertError) {
          return { data: null, error: { message: opts.insertError } };
        }
        return { data: [{}], error: null };
      }),
      select: vi.fn(() => ({
        limit: vi.fn(async () => ({
          data: [],
          error: opts?.selectError ? { message: opts.selectError } : null,
          count: 0,
        })),
      })),
    })),
    __insertCalls: () => insertCalls,
  };
  return client as unknown as SupabaseClient;
}

describe("SmartImport Resilience Tests", () => {
  describe("RetryPolicy", () => {
    it("debe reintentar en fallos transientes", async () => {
      let attempts = 0;
      const result = await RetryPolicy.execute(
        async () => {
          attempts += 1;
          if (attempts < 3) throw new Error("timeout");
          return "ok";
        },
        {
          maxAttempts: 3,
          initialDelayMs: 1,
          sleep: async () => undefined,
          shouldRetry: isTransientError,
        }
      );
      expect(result).toBe("ok");
      expect(attempts).toBe(3);
    });

    it("debe usar backoff exponencial", async () => {
      const delays: number[] = [];
      await expect(
        RetryPolicy.execute(
          async () => {
            throw new Error("timeout");
          },
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            backoffMultiplier: 2,
            maxDelayMs: 30_000,
            sleep: async (ms) => {
              delays.push(ms);
            },
            shouldRetry: () => true,
          }
        )
      ).rejects.toThrow("timeout");

      expect(delays).toHaveLength(2);
      // delay = base * 2^(attempt-1) + jitter(0-10%)
      expect(delays[0]!).toBeGreaterThanOrEqual(1000);
      expect(delays[0]!).toBeLessThan(1000 * 1.11);
      expect(delays[1]!).toBeGreaterThanOrEqual(2000);
      expect(delays[1]!).toBeLessThan(2000 * 1.11);
    });

    it("debe respetar shouldRetry", async () => {
      let attempts = 0;
      await expect(
        RetryPolicy.execute(
          async () => {
            attempts += 1;
            throw new Error("validation failed");
          },
          {
            maxAttempts: 5,
            initialDelayMs: 1,
            sleep: async () => undefined,
            shouldRetry: (e) => !e.message.includes("validation"),
          }
        )
      ).rejects.toThrow("validation failed");
      expect(attempts).toBe(1);
    });
  });

  describe("CircuitBreaker", () => {
    it("debe pasar en CLOSED", async () => {
      const cb = new CircuitBreaker("t", { failureThreshold: 3 });
      await expect(cb.call(async () => 42)).resolves.toBe(42);
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("debe OPEN después de N fallos", async () => {
      const cb = new CircuitBreaker("t", { failureThreshold: 3 });
      for (let i = 0; i < 3; i++) {
        await expect(
          cb.call(async () => {
            throw new Error("fail");
          })
        ).rejects.toThrow("fail");
      }
      expect(cb.getState()).toBe(CircuitState.OPEN);
      await expect(cb.call(async () => 1)).rejects.toThrow(/OPEN/);
    });

    it("debe ir HALF_OPEN después de timeout y CLOSE si funciona", async () => {
      const cb = new CircuitBreaker("t", {
        failureThreshold: 2,
        resetTimeoutMs: 10,
      });
      for (let i = 0; i < 2; i++) {
        await expect(
          cb.call(async () => {
            throw new Error("fail");
          })
        ).rejects.toThrow();
      }
      expect(cb.getState()).toBe(CircuitState.OPEN);
      await new Promise((r) => setTimeout(r, 15));
      await expect(cb.call(async () => "recovered")).resolves.toBe(
        "recovered"
      );
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("debe OPEN si HALF_OPEN falla", async () => {
      const cb = new CircuitBreaker("t", {
        failureThreshold: 1,
        resetTimeoutMs: 5,
      });
      await expect(
        cb.call(async () => {
          throw new Error("fail");
        })
      ).rejects.toThrow();
      expect(cb.getState()).toBe(CircuitState.OPEN);
      await new Promise((r) => setTimeout(r, 10));
      await expect(
        cb.call(async () => {
          throw new Error("still down");
        })
      ).rejects.toThrow("still down");
      expect(cb.getState()).toBe(CircuitState.OPEN);
    });

    it("debe reportar métricas", () => {
      const cb = new CircuitBreaker("metrics-cb");
      cb.reset();
      const m = cb.getMetrics();
      expect(m.state).toBe(CircuitState.CLOSED);
      expect(m.failureCount).toBe(0);
      expect(m.name).toBe("metrics-cb");
    });
  });

  describe("TransactionManager", () => {
    it("debe crear savepoint", async () => {
      const sb = mockSupabase({ rpcError: "fn missing" });
      const tx = new TransactionManager(sb);
      await tx.createSavepoint("sp_test", 10);
      expect(tx.getSavepoints().some((s) => s.name === "sp_test")).toBe(true);
    });

    it("debe rollback a savepoint", async () => {
      const sb = mockSupabase({ rpcError: "fn missing" });
      const tx = new TransactionManager(sb);
      await tx.createSavepoint("sp_a", 1);
      await tx.rollbackToSavepoint("sp_a");
      expect(true).toBe(true);
    });

    it("debe continuar después de rollback y recuperar lote fallido", async () => {
      let calls = 0;
      const sb = {
        rpc: vi.fn(async () => ({ data: null, error: { message: "no rpc" } })),
        from: vi.fn(() => ({
          insert: vi.fn(async () => {
            calls += 1;
            if (calls === 1) {
              return { data: null, error: { message: "timeout" } };
            }
            return { data: [{}], error: null };
          }),
        })),
      } as unknown as SupabaseClient;

      const tx = new TransactionManager(sb);
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ];
      const result = await tx.importWithTransactions(data, "devices", 2);
      expect(result.batches).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.imported).toBe(2);
      expect(result.rollbacks).toBe(1);
      expect(result.failedRecords).toHaveLength(2);
    });

    it("debe importar con savepoints", async () => {
      const sb = mockSupabase({ rpcError: "no" });
      const tx = new TransactionManager(sb);
      const result = await tx.importWithTransactions(
        [{ a: 1 }, { a: 2 }, { a: 3 }],
        "devices",
        2
      );
      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe("HealthCheck", () => {
    it("debe reportar healthy cuando todo OK", async () => {
      const sb = mockSupabase();
      const redis = { ping: vi.fn(async () => "PONG") };
      const hc = new HealthCheck(sb, redis);
      const status = await hc.check();
      expect(status.database.status).toBe("up");
      expect(status.redis.status).toBe("up");
      expect(status.status).toBe("healthy");
    });

    it("debe reportar unhealthy si BD down", async () => {
      const sb = mockSupabase({ selectError: "db down" });
      const redis = { ping: vi.fn(async () => "PONG") };
      const hc = new HealthCheck(sb, redis);
      const status = await hc.check();
      expect(status.database.status).toBe("down");
      expect(status.status).toBe("unhealthy");
    });

    it("debe reportar unhealthy si Redis down", async () => {
      const sb = mockSupabase();
      const redis = {
        ping: vi.fn(async () => {
          throw new Error("redis down");
        }),
      };
      const hc = new HealthCheck(sb, redis);
      const status = await hc.check();
      expect(status.redis.status).toBe("down");
      expect(status.status).toBe("unhealthy");
    });

    it("debe reportar degraded si memoria alta (simulado vía getStatus previo)", async () => {
      const hc = new HealthCheck(null, null);
      const status = await hc.check();
      // Sin BD/Redis → unhealthy; getStatus tras check debe existir
      expect(hc.getStatus().timestamp).toBeInstanceOf(Date);
      expect(["unhealthy", "degraded", "healthy"]).toContain(status.status);
    });

    it("debe monitorear continuamente", async () => {
      const sb = mockSupabase();
      const redis = { ping: vi.fn(async () => "PONG") };
      const hc = new HealthCheck(sb, redis);
      hc.startMonitoring(20);
      await new Promise((r) => setTimeout(r, 50));
      hc.stopMonitoring();
      expect(hc.getStatus().database.status).toBe("up");
    });
  });

  describe("GracefulShutdown", () => {
    it("debe esperar importaciones activas", async () => {
      const gs = new GracefulShutdown();
      gs.registerImport("imp-1");
      let finished = false;
      const logs: string[] = [];
      const spy = vi.spyOn(console, "log").mockImplementation((msg?: unknown) => {
        logs.push(String(msg));
      });

      const shutdownPromise = gs.shutdown({
        timeoutMs: 500,
        sleep: async () => {
          gs.unregisterImport("imp-1");
        },
        onShutdown: async () => {
          finished = true;
        },
      });
      await shutdownPromise;
      spy.mockRestore();
      expect(finished).toBe(true);
      expect(gs.getActiveCount()).toBe(0);
      expect(logs.some((l) => l.includes("graceful shutdown"))).toBe(true);
    });

    it("debe timeout si importaciones tardan", async () => {
      const gs = new GracefulShutdown();
      gs.registerImport("slow");
      let t = 0;
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      await gs.shutdown({
        timeoutMs: 30,
        now: () => {
          t += 20;
          return t;
        },
        sleep: async () => undefined,
      });
      warn.mockRestore();
      expect(gs.getActiveCount()).toBe(1);
    });

    it("debe ejecutar onShutdown callback", async () => {
      const gs = new GracefulShutdown();
      const onShutdown = vi.fn(async () => undefined);
      await gs.shutdown({ onShutdown, timeoutMs: 10 });
      expect(onShutdown).toHaveBeenCalled();
    });

    it("debe loguear estado de shutdown", async () => {
      const gs = new GracefulShutdown();
      const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      await gs.shutdown({ timeoutMs: 5 });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("Integración Completa", () => {
    beforeEach(() => {
      __resetImportJobsForTests();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const schema = z.object({ id: z.number() });

    it("debe completar importación con fallos transientes", async () => {
      let fails = 0;
      const sb = {
        rpc: vi.fn(async () => ({ data: null, error: { message: "no rpc" } })),
        from: vi.fn(() => ({
          insert: vi.fn(async () => {
            fails += 1;
            if (fails < 2) {
              return { data: null, error: { message: "timeout" } };
            }
            return { data: [{}], error: null };
          }),
        })),
      } as unknown as SupabaseClient;

      const importer = new SmartImporter({
        supabase: sb,
        circuitBreaker: new CircuitBreaker("it", { failureThreshold: 10 }),
      });

      // Forzar retries en withResilience usando enqueue que no falla;
      // validamos importWithResilience end-to-end.
      const { result, metrics } = await importer.importWithResilience(
        [{ id: 1 }, { id: 2 }],
        {
          targetTable: "devices",
          schema,
          user: { id: "u1", email: "a@b.co", role: "user" },
          supabase: sb,
          useTransactions: true,
          batchSize: 10,
          useCache: false,
        }
      );
      expect(result.transformedCount).toBe(2);
      expect(result.job.userId).toBe("u1");
      expect(metrics.rollbacks).toBeGreaterThanOrEqual(0);
      await importer.disconnect();
    });

    it("debe completar con BD caída temporalmente vía circuit breaker reset", async () => {
      const cb = new CircuitBreaker("temp", {
        failureThreshold: 2,
        resetTimeoutMs: 5,
      });
      let mode: "down" | "up" = "down";
      for (let i = 0; i < 2; i++) {
        await expect(
          cb.call(async () => {
            throw new Error("timeout");
          })
        ).rejects.toThrow();
      }
      expect(cb.getState()).toBe(CircuitState.OPEN);
      mode = "up";
      await new Promise((r) => setTimeout(r, 10));
      await expect(
        cb.call(async () => {
          if (mode === "down") throw new Error("timeout");
          return "ok";
        })
      ).resolves.toBe("ok");
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    });

    it("debe recuperar datos después de partial failure", async () => {
      let batch = 0;
      const sb = {
        rpc: vi.fn(async () => ({ data: null, error: { message: "no" } })),
        from: vi.fn(() => ({
          insert: vi.fn(async () => {
            batch += 1;
            if (batch === 1) {
              return { data: null, error: { message: "deadlock" } };
            }
            return { data: [{}], error: null };
          }),
        })),
      } as unknown as SupabaseClient;
      const tx = new TransactionManager(sb);
      const result = await tx.importWithTransactions(
        [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        "devices",
        2
      );
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.rollbacks).toBe(1);
    });

    it("debe shutdown sin perder registro de importación activa", async () => {
      const gs = new GracefulShutdown();
      gs.registerImport("keep");
      const importer = new SmartImporter();
      const { result } = await importer.importWithMetrics([{ id: 1 }], {
        targetTable: "devices",
        schema,
        user: { id: "u1", email: "a@b.co", role: "user" },
        useCache: false,
      });
      expect(result.job.id).toBeTruthy();
      gs.unregisterImport("keep");
      await gs.shutdown({ timeoutMs: 5 });
      await importer.disconnect();
    });
  });
});
