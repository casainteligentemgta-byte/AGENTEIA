/**
 * @agenteia/smart-import — Fase 1 (seguridad)
 *
 * ## Scripts
 * ```bash
 * cd packages/smart-import
 * npm install
 * npm run lint
 * npm test
 * npm run test:coverage
 * npm run dev   # http://localhost:3000
 * ```
 *
 * ## Montar en Express
 * ```ts
 * import express from "express";
 * import { importRouter } from "@agenteia/smart-import";
 *
 * const app = express();
 * app.use(express.json({ limit: "2mb" }));
 * app.use("/api/import", importRouter);
 * ```
 *
 * ## Probar
 * ```bash
 * curl -X POST http://localhost:3000/api/import/execute \
 *   -H "Authorization: Bearer YOUR_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"data":[{"id":1}],"targetTable":"devices"}'
 * ```
 *
 * Variables de entorno:
 * - `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
 * - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
 * - `REDIS_HOST` / `REDIS_PORT` (preferido) o `REDIS_URL` (opcional; sin ellos usa memoria)
 * - `PORT` (default 3000)
 */
