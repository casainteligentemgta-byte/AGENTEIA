# Runbook de producción — SmartImport

## Severidad

| Nivel | Criterio | Respuesta |
|-------|----------|-----------|
| SEV-1 | API down / error rate > 20% | Página inmediata, rollback |
| SEV-2 | Latencia p95 > 5s o Redis down | Mitigar, escalar, avisar |
| SEV-3 | Degradación parcial / disco alto | Ticket, ventana de mant. |

## Playbooks

### 1. `/health` unhealthy

1. `kubectl -n smartimport get pods`
2. Logs: `kubectl -n smartimport logs -l app=smartimport --tail=200`
3. Verificar Redis / Supabase
4. Si OOM: subir limits o bajar batch size
5. Si crash loop: rollback imagen

### 2. Rate limit masivo (429)

- Confirmar abuso vs. tráfico legítimo
- Admins no tienen el mismo límite en `/execute`
- Escalar pods (HPA) y/o revisar `importLimiter`

### 3. Redis caído

- CacheManager cae a memoria local
- Rate-limit puede degradar a memoria
- Restaurar Redis; no requiere redeploy de app

### 4. Pico de importaciones

```bash
kubectl -n smartimport scale deploy/smartimport --replicas=10
# HPA tomará el control después
```

### 5. Disco / logs

- Compose: `json-file` max 10m × 5
- K8s: revisar PVC de Prometheus/Grafana si aplica

## Contactos / escalado

1. On-call (Slack / PagerDuty si Fase 4 alertas configuradas)
2. Owner del servicio SmartImport
3. Infra / plataforma K8s

## Post-mortem mínimo

- Timeline, impacto, causa raíz, acción correctiva, follow-ups
