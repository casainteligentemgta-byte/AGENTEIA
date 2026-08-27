/**
 * @agenteia/smart-import — Fase 1 (seguridad) + Fase 2 (caché) + Fase 3 (resiliencia)
 *
 * ## Scripts
 * ```bash
 * cd packages/smart-import
 * npm install
 * npm run lint
 * npm test
 * npm run test:performance
 * npm run test:resilience
 * npm run build
 * npm run dev   # http://localhost:3000  (GET /health)
 * ```
 *
 * ## Fase 3
 * - `RetryPolicy` — backoff exponencial + jitter
 * - `CircuitBreaker` — CLOSED / OPEN / HALF_OPEN
 * - `TransactionManager` — savepoints por lote (RPC o fallback)
 * - `HealthCheck` — BD / Redis / memoria / disco
 * - `GracefulShutdown` — espera imports activos en SIGTERM/SIGINT
 *
 * Variables: `SUPABASE_*`, `REDIS_HOST`/`PORT`/`PASSWORD` o `REDIS_URL`, `PORT`,
 * `HEALTH_MONITOR=0` para desactivar monitor.
 */
