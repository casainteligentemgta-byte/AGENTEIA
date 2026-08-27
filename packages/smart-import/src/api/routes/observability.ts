/**
 * Rutas de observabilidad: /metrics, /health, readiness, liveness, summary.
 */

import { Router, type Request, type Response } from "express";
import { metricsCollector } from "../../services/metrics/MetricsCollector";
import { logger } from "../../services/logging/Logger";
import { HealthCheck } from "../../services/health/HealthCheck";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ObservabilityDeps = {
  health: HealthCheck;
  supabase?: SupabaseClient | null;
  redis?: { ping: () => Promise<unknown> } | null;
};

function formatPct(n: number): string {
  return `${n.toFixed(0)}%`;
}

export function createObservabilityRouter(deps: ObservabilityDeps): Router {
  const router = Router();
  const { health } = deps;

  router.get("/metrics", async (_req: Request, res: Response) => {
    try {
      const body = await metricsCollector.getMetrics();
      res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.send(body);
    } catch (err) {
      logger.error(
        "Error sirviendo /metrics",
        err instanceof Error ? err : new Error(String(err))
      );
      res.status(500).send("# error collecting metrics\n");
    }
  });

  router.get("/health", async (_req: Request, res: Response) => {
    const status = await health.check();
    const code = status.status === "unhealthy" ? 503 : 200;
    res.status(code).json({
      status: status.status,
      timestamp: status.timestamp.toISOString(),
      uptime: process.uptime(),
      services: {
        database: status.database.status,
        redis: status.redis.status,
        memory: formatPct(status.memory.percentage),
        disk: formatPct(status.disk.percentage),
      },
      details: {
        database: status.database,
        redis: status.redis,
        memory: status.memory,
        disk: status.disk,
      },
    });
  });

  router.get("/health/readiness", async (_req: Request, res: Response) => {
    const status = await health.check();
    const redisConfigured = Boolean(
      process.env.REDIS_URL?.trim() || process.env.REDIS_HOST?.trim()
    );
    const dbConfigured = Boolean(
      process.env.SUPABASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    );
    const redisOk = !redisConfigured || status.redis.status === "up";
    const dbOk = !dbConfigured || status.database.status === "up";
    const memOk = status.memory.percentage < 95;

    if (dbOk && redisOk && memOk) {
      res.status(200).json({ ready: true, status: status.status });
      return;
    }

    res.status(503).json({
      ready: false,
      status: status.status,
      services: {
        database: status.database.status,
        redis: status.redis.status,
        memory: formatPct(status.memory.percentage),
      },
    });
  });

  router.get("/health/liveness", (_req: Request, res: Response) => {
    res.status(200).json({ alive: true, uptime: process.uptime() });
  });

  router.get("/metrics/summary", (_req: Request, res: Response) => {
    const summary = metricsCollector.getSummary();
    res.json({
      imports_total: summary.imports_total,
      success_rate: `${summary.success_rate}%`,
      avg_duration_ms: summary.avg_duration_ms,
      errors_total: summary.errors_total,
      active_imports: summary.active_imports,
      cache_hit_rate: `${summary.cache_hit_rate}%`,
    });
  });

  return router;
}

export default createObservabilityRouter;
