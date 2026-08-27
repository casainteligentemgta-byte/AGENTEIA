# SmartImport Testing Guide

## Tipos de tests

### Unit Tests
```bash
cd packages/smart-import
npm run test
```

### Coverage
```bash
npm run coverage
# o: npm run test:coverage
```

### E2E (Playwright — API harness en :3100)
```bash
npm run test:e2e
npm run test:e2e:ui      # UI interactiva
npm run test:e2e:debug
```

> El paquete es **API-only** (sin UI `/import`). Los E2E validan el flujo
> analyze → validate → execute → history vía HTTP contra `e2e/server.ts`.

### Load tests (k6)
```bash
# Terminal 1: harness E2E
npx tsx e2e/server.ts

# Terminal 2:
export PATH="$(pwd)/.bin:$PATH"   # si usas el binario local
k6 run load-test/import.load.js
SCENARIO=smoke k6 run load-test/import.load.js
SCENARIO=spike k6 run load-test/import.load.js
```

Escenarios: `gradual` (default), `burst`, `spike`, `endurance`, `smoke`.

### Chaos
```bash
npm run test:chaos
```

### Security
```bash
npm run test:security
```

### Performance
```bash
npm run test:performance
```

### Contract + Integration
```bash
npm run test:contract
npm run test:integration
```

### Suite completa (sin load k6)
```bash
npm run test:all
```

## CI/CD

Workflow: `.github/workflows/smart-import-test.yml`

- Push/PR a `main`/`develop` con cambios en `packages/smart-import/**`
- Jobs: unit, e2e, security, performance, chaos, contract+integration

## Variables útiles

| Variable | Uso |
|----------|-----|
| `E2E_PORT` | Puerto harness (default 3100) |
| `E2E_BASE_URL` | Base URL Playwright |
| `BASE_URL` | k6 target |
| `SCENARIO` | Escenario k6 |
| `CI` | Activa retries Playwright |

## Estructura

```
e2e/                 Playwright + harness
load-test/           k6 scripts
chaos-test/          Chaos + failure injectors
src/__tests__/
  unit/
  performance/
  resilience/
  security/
  contract/
  integration/
```
