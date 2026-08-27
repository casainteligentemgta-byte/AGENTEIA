# Contribuir a SmartImport

## Requisitos

- Node 20+
- npm 10+
- Docker (opcional, para stack completo)
- kubectl (opcional, para K8s)

## Setup

```bash
cd packages/smart-import
cp .env.example .env
npm install
npm run lint
npm test
npm run build
npm run dev
```

Con stack completo:

```bash
npm run docker:up
curl -s http://localhost:3000/health | jq .status
```

## Workflow

Flujo de trabajo recomendado (GitHub Flow):

1. **Branch:** `cursor/<descripcion>-dd2a` (o convención del equipo)
2. Cambios pequeños y enfocados (KISS)
3. Tests verdes: `npm test` (+ `npm run test:e2e` si tocas API/E2E)
4. Lint/build: `npm run lint && npm run build`
5. **PR** a `main` · CI (`ci.yml` / SmartImport Test) debe pasar
6. No commitear secretos ni `.env`
7. Tras merge: CD publica imagen a GHCR cuando cambian rutas del paquete

### Checklist del PR

- [ ] Descripción clara del cambio
- [ ] Tests actualizados si hay lógica nueva
- [ ] Docs tocadas si cambia deploy/API (`docs/`)
- [ ] Sin credenciales en el diff

## Estructura

```
src/api/          Express + Swagger
src/services/     Dominio (import, cache, retry, health, …)
docs/             Documentación
k8s/              Manifests production
Dockerfile        Imagen multi-stage
e2e/              Playwright
```

## Estilo

- TypeScript strict · sin `any` innecesario
- Validación Zod en el límite
- Server-first; `use client` no aplica en este paquete API
- Nombres descriptivos · KISS / DRY

## Documentación

- API: Swagger `/api/docs` + `docs/API.md`
- Deploy: `docs/DEPLOYMENT.md`
- Incidentes: `docs/RUNBOOK.md`
- Escala: `docs/SCALING.md`

## Preguntas

Abrir issue/PR en el repo AGENTEIA o consultar al owner del módulo.
