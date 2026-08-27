# Guía de Deployment — SmartImport

## 1. Docker imagen

```bash
cd packages/smart-import
docker build -t smartimport:latest .
docker run --rm -p 3000:3000 \
  -e SUPABASE_URL=... \
  -e SUPABASE_ANON_KEY=... \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  smartimport:latest
```

Imagen multi-stage (Node 20 Alpine). Entry: `node dist/api/server.js`.

## 2. Docker Compose (local / staging)

```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:3000/health | jq
```

Producción (override):

```bash
export POSTGRES_PASSWORD='***'
export GF_SECURITY_ADMIN_PASSWORD='***'
export SMARTIMPORT_IMAGE=ghcr.io/org/smartimport:1.0.0
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Perfil observabilidad:

```bash
docker compose --profile observability up -d
```

## 3. Kubernetes

```bash
# Editar secrets en k8s/smartimport.yaml
kubectl apply -f k8s/smartimport.yaml
kubectl -n smartimport get pods,svc,hpa
kubectl -n smartimport rollout status deploy/smartimport
```

HPA: mín 3 / máx 20 réplicas (CPU 70%, memoria 80%).

## 4. CI/CD

- Tests: `.github/workflows/smart-import-test.yml` (Fase 5)
- Deploy imagen: `.github/workflows/smart-import-deploy.yml`

Push a `main` con cambios en `packages/smart-import/**` construye y publica la imagen (GHCR) si `GITHUB_TOKEN` tiene `packages: write`.

### Secrets recomendados (GitHub → Settings → Secrets and variables → Actions)

| Secret | Uso |
|--------|-----|
| `AWS_REGISTRY` | URI del registry ECR (si despliegas a AWS) |
| `AWS_ACCOUNT_ID` | Cuenta AWS |
| `SLACK_WEBHOOK` | Notificaciones de deploy / fallos |
| `STAGING_KUBECONFIG` | kubeconfig staging (base64) |
| `PROD_KUBECONFIG` | kubeconfig producción (base64) |
| `DATABASE_URL` / `SUPABASE_URL` | Conexión datos |
| `REDIS_URL` | Caché / rate-limit |
| `SUPABASE_ANON_KEY` | Auth API |

> No commitear valores. En K8s preferir `Secret` / External Secrets Operator.

## 5. Checklist pre-prod

- [ ] `SUPABASE_URL` / `SUPABASE_ANON_KEY` configurados
- [ ] Redis reachable (`REDIS_URL`)
- [ ] `/health` → 200 en al menos un pod
- [ ] Swagger desactivable (`DISABLE_SWAGGER=1`) si no se desea público
- [ ] Secrets no commiteados
- [ ] HPA / resource limits activos
- [ ] Backup Postgres / política retención logs

## 6. Rollback

```bash
kubectl -n smartimport rollout undo deploy/smartimport
# o pin de imagen:
kubectl -n smartimport set image deploy/smartimport app=ghcr.io/org/smartimport:PREV_TAG
```
