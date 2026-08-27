# Escalabilidad — SmartImport

## Horizontal (recomendado)

| Mecanismo | Config |
|-----------|--------|
| Réplicas base | 3 (`k8s/20-app.yaml`) |
| HPA | CPU 70% / memoria 80% · min 3 · max 20 |
| Compose prod | `deploy.replicas: 3` en `docker-compose.prod.yml` |

```bash
# Escala manual
kubectl -n production scale deploy/smartimport --replicas=10

# Ver HPA
kubectl -n production get hpa smartimport -w
```

## Vertical

Límites por pod (ajustar según carga real):

- requests: 250m CPU / 256Mi
- limits: 1 CPU / 512Mi

## Cuellos de botella conocidos

1. **Validación / transform** — CPU bound; más pods ayudan.
2. **Redis** — rate-limit y caché; si satura, Redis Cluster o Memorystore.
3. **Supabase / Postgres** — connection pooling (PgBouncer) si hay muchas réplicas.
4. **Batch size** — máx 10 000 registros; partir cargas grandes.

## Autoscaling de carga (k6)

```bash
# smoke / gradual (requiere app + k6; ver Fase 5)
SCENARIO=spike k6 run load-test/import.load.js
```

## Checklist antes de subir maxReplicas

- [ ] Alertas de error rate y latencia (Fase 4)
- [ ] Redis dimensionado
- [ ] Límites de rate-limit coherentes con tráfico
- [ ] Prueba de spike en staging
