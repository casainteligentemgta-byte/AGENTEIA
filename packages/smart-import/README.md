/**
 * @agenteia/smart-import — Fase 1 (seguridad)
 *
 * Paquete con validación de archivos, rate limiting y auth para importaciones.
 * Pensado para montarse en un servidor Express:
 *
 * ```ts
 * import express from "express";
 * import { importRouter } from "@agenteia/smart-import";
 *
 * const app = express();
 * app.use(express.json({ limit: "2mb" }));
 * app.use("/api/import", importRouter);
 * ```
 *
 * Variables de entorno:
 * - NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 * - REDIS_URL (opcional; sin ella el rate limit usa memoria)
 */
