# Runbook de producción — SmartImport

## Severidad

| Nivel | Criterio | Respuesta |
|-------|----------|-----------|
| SEV-1 | API down / error rate > 20% | Página inmediata, rollback |
| SEV-2 | Latencia p95 > 5s o Redis down | Mitigar, escalar, avisar |
| SEV-3 | Degradación parcial / disco alto | Ticket, ventana de mant. |

## Playbooks

### 1. `/health` unhealthy

1. `kubectl -n production get pods`
2. Logs: `kubectl -n production logs -l app=smartimport --tail=200`
3. Verificar Redis / Supabase / `DATABASE_URL`
4. Si OOM: subir limits o bajar batch size
5. Si crash loop: rollback imagen

### 2. High Latency

Síntomas: p95 > 2–5s en `/api/import/*`, timeouts de cliente, HPA subiendo réplicas.

1. Revisar Grafana / Prometheus: `smartimport_import_duration_seconds`, CPU, memoria
2. `kubectl -n production top pods`
3. Confirmar si el cuello es validación CPU, Redis o Postgres/Supabase
4. Mitigar: escalar réplicas, reducir batch size, revisar rate-limit
5. Si es query lenta: índices / pool / circuit breaker (Fase 3)

### 3. Database Down

Síntomas: `/health` → `database: "down"`, readiness 503, errores en execute.

1. Compose: `docker compose logs postgres` · `pg_isready`
2. K8s: estado del Secret `DATABASE_URL` / Supabase status page
3. Red: desde el pod, ¿resuelve y conecta al host de BD?
4. Si solo falla Supabase pero hay Postgres local: configurar `DATABASE_URL` para health
5. Restaurar BD / rotar credenciales; no redeploy salvo cambio de env

### 4. Rate limit masivo (429)

- Confirmar abuso vs. tráfico legítimo
- Admins no tienen el mismo límite en `/execute`
- Escalar pods (HPA) y/o revisar `importLimiter`
- Rate-limit Redis opcional (`RATE_LIMIT_USE_REDIS=1`)

### 5. Redis caído

- CacheManager cae a memoria local
- Rate-limit usa memoria por defecto
- Restaurar Redis; no requiere redeploy de app

### 6. Pico de importaciones

```bash
kubectl -n production scale deploy/smartimport --replicas=10
# HPA tomará el control después
```

### 7. Disco / logs

- Compose: `json-file` max 10m × 5
- K8s: revisar PVC de Prometheus/Grafana si aplica
- App escribe en `/app/logs` (debe ser writable)

## Contactos / escalado

1. On-call (Slack / PagerDuty si Fase 4 alertas configuradas)
2. Owner del servicio SmartImport
3. Infra / plataforma K8s

## Post-mortem mínimo

- Timeline, impacto, causa raíz, acción correctiva, follow-ups
