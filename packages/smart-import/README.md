/**
 * @agenteia/smart-import — Fase 1–4 (seguridad, caché, resiliencia, observabilidad)
 *
 * ## Scripts
 * ```bash
 * cd packages/smart-import
 * npm install
 * npm run lint
 * npm test
 * npm run test:performance
 * npm run test:resilience
 * npm run test:observability
 * npm run build
 * npm run dev   # http://localhost:3000
 * ```
 *
 * ## Fase 4 — Observabilidad
 * - Winston (`Logger`) — logs estructurados + rotación + Sentry opcional
 * - Prometheus (`MetricsCollector`) — counters / histograms / gauges
 * - OpenTelemetry → Jaeger (`Tracer`)
 * - `AlertManager` — Slack / SendGrid / PagerDuty
 * - Endpoints: `GET /metrics`, `/health`, `/health/readiness`, `/health/liveness`, `/metrics/summary`
 *
 * Stack Docker (Prometheus :9090, Grafana :3001, Jaeger :16686):
 * ```bash
 * docker compose up -d
 * ```
 *
 * Variables: `LOG_LEVEL`, `JAEGER_HOST`, `JAEGER_PORT`, `JAEGER_ENDPOINT`,
 * `OTEL_ENABLED=0` para desactivar tracing, `SENTRY_DSN`,
 * `SLACK_WEBHOOK_URL`, `SENDGRID_API_KEY`, `PAGERDUTY_KEY`, `ON_CALL_EMAIL`,
 * más las de Fases 1–3 (`SUPABASE_*`, `REDIS_*`, `PORT`, `HEALTH_MONITOR`).
 */
