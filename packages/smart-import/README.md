/**
 * @agenteia/smart-import — Fase 1 (seguridad) + Fase 2 (caché / optimización)
 *
 * ## Scripts
 * ```bash
 * cd packages/smart-import
 * npm install
 * npm run lint
 * npm test
 * npm run test:performance
 * npm run test:coverage
 * npm run build
 * npm run dev   # http://localhost:3000
 * ```
 *
 * ## Fase 2 — APIs principales
 * - `CacheManager` — Redis (`REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` o `REDIS_URL`) con fallback memoria
 * - `CachedValidationEngine` — validación Zod con cache-aside
 * - `OptimizedReferenceValidator` — FKs en bulk (sin N+1)
 * - `StreamingDataTransformer` — transform por lotes + métricas
 * - `SmartImporter` — orquestación `importWithStrategy` / `importWithMetrics`
 * - `FileParser.parseFile(..., { streaming: true })` — JSON/CSV por chunks (PapaParse)
 *
 * ## Montar en Express
 * ```ts
 * import express from "express";
 * import { importRouter, SmartImporter } from "@agenteia/smart-import";
 *
 * const app = express();
 * app.use(express.json({ limit: "2mb" }));
 * app.use("/api/import", importRouter);
 * ```
 *
 * Variables de entorno:
 * - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
 * - `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` (preferido) o `REDIS_URL`
 * - `PORT` (default 3000)
 */
