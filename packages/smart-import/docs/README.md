# SmartImport — Documentación

## Quick start

### Local (con Docker)

```bash
cd packages/smart-import
cp .env.example .env   # completar SUPABASE_* / POSTGRES_PASSWORD / DATABASE_URL
docker compose up -d --build
# ✅ App         http://localhost:3000
# ✅ Swagger     http://localhost:3000/api/docs
# ✅ Health      http://localhost:3000/health
# ✅ Metrics     http://localhost:3000/metrics
# ✅ Grafana     http://localhost:3001  (admin/admin)
# ✅ Jaeger      http://localhost:16686
# ✅ Prometheus  http://localhost:9090
```

### Local (sin Docker)

```bash
npm install
npm run build
REDIS_URL=redis://127.0.0.1:6379 \
DATABASE_URL=postgresql://smartimport:smartimport_dev_change_me@127.0.0.1:5432/smartimport \
  npm run start
# desarrollo:
npm run dev
```

### Verificación rápida

```bash
curl -s http://localhost:3000/health/liveness
curl -s http://localhost:3000/health/readiness
curl -s http://localhost:3000/health | jq .status
curl -s http://localhost:3000/metrics | head
```

Esperado: `status` = `"healthy"` con `database` y `redis` en `"up"` (con `DATABASE_URL` + Redis).

## Índice

| Documento | Contenido |
|-----------|-----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Prerequisites, Docker, docker-compose, Kubernetes, CI/CD |
| [RUNBOOK.md](./RUNBOOK.md) | Incidentes (High Latency, Database Down), escalado, rollback |
| [API.md](./API.md) | Endpoints, Request/Response, autenticación |
| [SCALING.md](./SCALING.md) | Horizontal, Auto-Scaling (HPA), cuellos de botella |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Setup, Workflow de contribución |
| [TESTING.md](./TESTING.md) | Suite de tests (unit, E2E, load, chaos) |

## Arquitectura (producción)

```
Internet → Ingress/LB → SmartImport (3+ pods, HPA)
                           ├─ Supabase (Auth + Postgres)  ó  Postgres local (DATABASE_URL)
                           └─ Redis (caché / rate-limit)
Observability: Prometheus + Grafana + Jaeger (opcional)
```

### Componentes

| Pieza | Rol |
|-------|-----|
| Express API | Import analyze/validate/transform/execute |
| Redis | Caché de validación + rate-limit (memoria si cae) |
| Supabase / Postgres | Persistencia y auth JWT |
| Prometheus | Scraping `/metrics` |
| Grafana | Dashboards (puerto host 3001) |
| Jaeger | Trazas (OTEL opcional) |

## Fases del producto

1. **Seguridad** — Auth Bearer, rate-limit, permisos por tabla  
2. **Caché / optimización** — CacheManager, validación bulk  
3. **Resiliencia** — Retry, circuit breaker, graceful shutdown, health  
4. **Observabilidad** — Winston, Prometheus, Jaeger, AlertManager  
5. **Tests** — Unit, E2E Playwright, k6, chaos, contract, security  
6. **Documentación & Deployment** — Docker, K8s, Swagger, CI/CD (esta fase)

## Scripts npm útiles

```bash
npm run build          # tsc → dist/
npm run lint           # typecheck
npm test               # unitarios
npm run test:e2e       # Playwright
npm run docker:build   # imagen smartimport:latest
npm run docker:up      # docker compose up -d --build
npm run k8s:apply      # aplica manifests base
npm run k8s:status     # pods/svc/hpa en namespace production
```

## Endpoints clave

- `GET /health` · `GET /health/liveness` · `GET /health/readiness`
- `GET /metrics` (Prometheus)
- `GET /api/docs` (Swagger UI)
- `POST /api/import/execute` (Bearer JWT)

## Variables de entorno

Ver `.env.example` en la raíz del paquete:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` (producción con Supabase)
- `DATABASE_URL` (health / Postgres local del compose)
- `REDIS_URL` o `REDIS_HOST` + `REDIS_PORT`
- `LOG_LEVEL`, `NODE_ENV`, `PORT`, `OTEL_ENABLED`

## Troubleshooting Quick reference

| Síntoma | Acción |
|---------|--------|
| `/health` database down | Configurar `DATABASE_URL` o Supabase |
| Redis down | Revisar `REDIS_URL`; app degrada a memoria |
| App reinicia (EACCES logs) | Imagen debe crear `/app/logs` writable |
| Puerto 3000 ocupado | Liberar proceso o cambiar mapping en compose |

## Enlaces

- Runbook: [RUNBOOK.md](./RUNBOOK.md)
- Deploy: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Contribuir: [CONTRIBUTING.md](./CONTRIBUTING.md)
