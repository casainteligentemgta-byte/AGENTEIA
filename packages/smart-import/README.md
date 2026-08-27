/**
 * @agenteia/smart-import — Production ready (Fases 1–6)
 *
 * ## Quick start
 * ```bash
 * cd packages/smart-import
 * cp .env.example .env
 * npm install && npm run build && npm start
 * # o: npm run docker:up
 * ```
 *
 * - Health: `GET /health`
 * - Swagger: `GET /api/docs`
 * - Metrics: `GET /metrics`
 * - Docs: `docs/README.md`
 * - K8s: `k8s/` (namespace `production`)
 *
 * ## Tests
 * ```bash
 * npm test
 * npm run test:e2e
 * npm run test:chaos
 * npm run test:security
 * npm run test:observability
 * npm run test:load:smoke   # requiere: npm run dev:e2e + k6 en PATH
 * ```
 *
 * Guía tests: `docs/TESTING.md`
 *
 * ## Fase 4 — Observabilidad
 * - Winston, Prometheus, Jaeger, AlertManager
 * - `GET /metrics`, `/health`, `/health/readiness`, `/health/liveness`
 * - Docker: Prometheus :9090, Grafana :3001, Jaeger :16686
 */
