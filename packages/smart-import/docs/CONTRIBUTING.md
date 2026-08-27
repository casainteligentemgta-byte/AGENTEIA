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

## Flujo de trabajo

1. Branch: `cursor/<descripcion>-dd2a` (o convención del equipo)
2. Cambios pequeños y enfocados
3. Tests verdes: `npm test` (+ suites Fase 5 si están en la rama)
4. PR a `main` · CI debe pasar
5. No commitear secretos ni `.env`

## Estructura

```
src/api/          Express + Swagger
src/services/     Dominio (import, cache, retry, …)
docs/             Documentación
k8s/              Manifests production
Dockerfile        Imagen multi-stage
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
