import express from "express";
import { createClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";
import importRouter from "./routes/import";
import { createObservabilityRouter } from "./routes/observability";
import { gracefulShutdown } from "./middleware/gracefulShutdown";
import { requestLogger } from "./middleware/requestLogger";
import { HealthCheck } from "../services/health/HealthCheck";
import { CacheManager } from "../services/cache/CacheManager";
import { logger } from "../services/logging/Logger";
import { tracer } from "../services/tracing/Tracer";

const PORT = Number(process.env.PORT ?? 3000);

export function createSmartImportApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const supabase =
    supabaseUrl && supabaseKey
      ? createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  let redis: ReturnType<typeof createRedisClient> | null = null;
  const redisHost = process.env.REDIS_HOST?.trim();
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl || redisHost) {
    redis = redisUrl
      ? createRedisClient({ url: redisUrl })
      : createRedisClient({
          socket: {
            host: redisHost!,
            port: Number(process.env.REDIS_PORT ?? 6379),
          },
          password: process.env.REDIS_PASSWORD || undefined,
        });
    void redis.connect().catch((err: unknown) => {
      logger.warn("Redis no conectó", {
        error: err instanceof Error ? err.message : String(err),
      });
      redis = null;
    });
  }

  const health = new HealthCheck(supabase, redis);
  if (process.env.HEALTH_MONITOR !== "0") {
    health.startMonitoring(Number(process.env.HEALTH_INTERVAL_MS ?? 30_000));
  }

  app.use(
    createObservabilityRouter({
      health,
      supabase,
      redis,
    })
  );

  app.use("/api/import", importRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      logger.error(
        "Error no manejado en API",
        err instanceof Error ? err : new Error(String(err))
      );
      res.status(500).json({ success: false, error: "Error interno" });
    }
  );

  return { app, health, gracefulShutdown };
}

export async function main(): Promise<void> {
  const cache = new CacheManager();
  const { app, health } = createSmartImportApp();

  gracefulShutdown.setupSignalHandlers({
    timeoutMs: 30_000,
    onShutdown: async () => {
      logger.info("Cerrando conexiones…");
      health.stopMonitoring();
      await cache.disconnect();
      await tracer.shutdown();
    },
  });

  app.listen(PORT, () => {
    logger.info("SmartImport listening", {
      port: PORT,
      endpoints: [
        "GET /health",
        "GET /health/readiness",
        "GET /health/liveness",
        "GET /metrics",
        "GET /metrics/summary",
        "POST /api/import/execute",
      ],
    });
  });
}

if (require.main === module) {
  void main();
}
