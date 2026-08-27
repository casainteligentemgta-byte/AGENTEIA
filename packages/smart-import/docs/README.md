# SmartImport — Documentación

## Inicio Rápido

### Local (con Docker)

```bash
cd packages/smart-import
cp .env.example .env   # completar SUPABASE_* / POSTGRES_PASSWORD
docker compose up -d --build
# ✅ App      http://localhost:3000
# ✅ Swagger  http://localhost:3000/api/docs
# ✅ Health   http://localhost:3000/health
# ✅ Grafana  http://localhost:3001  (admin/admin)
# ✅ Jaeger   http://localhost:16686
# ✅ Prometheus http://localhost:9090
```

### Local (sin Docker)

```bash
npm install
npm run build
REDIS_URL=redis://127.0.0.1:6379 npm run start
# o desarrollo:
npm run dev
```

## Índice

| Documento | Contenido |
|-----------|-----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, Compose prod, Kubernetes, CI/CD |
| [RUNBOOK.md](./RUNBOOK.md) | Incidentes, escalado, rollback |
| [API.md](./API.md) | Endpoints y autenticación |
| [TESTING.md](./TESTING.md) | Suite de tests (si Fase 5 mergeada) |

## Arquitectura (producción)

```
Internet → Ingress/LB → SmartImport (3+ pods, HPA)
                           ├─ Supabase (Auth + Postgres)
                           └─ Redis (caché / rate-limit)
Observability: Prometheus + Grafana + Jaeger (opcional)
```

## Fases

1. Seguridad  
2. Caché / optimización  
3. Resiliencia  
4. Observabilidad  
5. Tests completos  
6. **Documentación & Deployment** (esta fase)

## Variables de entorno

Ver `.env.example`.
