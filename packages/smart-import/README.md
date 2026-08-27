/**
 * @agenteia/smart-import — Fases 1–5 (seguridad, caché, resiliencia, observabilidad, tests)
 *
 * ## Scripts
 * ```bash
 * cd packages/smart-import
 * npm install
 * npm run lint
 * npm test
 * npm run test:e2e
 * npm run test:chaos
 * npm run test:security
 * npm run test:performance
 * npm run test:resilience
 * npm run test:observability
 * npm run test:contract
 * npm run test:integration
 * npm run test:load:smoke   # requiere: npm run dev:e2e + k6 en PATH
 * npm run build
 * npm run dev   # http://localhost:3000
 * ```
 *
 * Guía tests: `docs/TESTING.md`
 *
 * ## Fase 4 — Observabilidad
 * - Winston, Prometheus, Jaeger, AlertManager
 * - `GET /metrics`, `/health`, `/health/readiness`, `/health/liveness`
 * - Docker: Prometheus :9090, Grafana :3001, Jaeger :16686
 */
