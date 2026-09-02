# Cronograma AGENTE IA

Stack: **Cursor** · **Gemini** (ideas) · **Supabase** · **Vercel** · OpenRouter/OpenAI (chat)

---

## Estado actual (resumen)

| Área | Estado |
|------|--------|
| Código + GitHub | ✅ |
| Supabase nuevo (`quocxyesrdwfyeynegkd`) | ✅ URL + seed memoria (6) — app `web` |
| OpenRouter (LLM) | ✅ local — app `web` |
| Serper (web) | ⏳ falta API key — app `web` |
| RLS misiones por usuario | ⏳ ejecutar `apps/web/supabase/deploy-rls-d7.sql` |
| Vercel deploy `web` | ✅ https://web-sand-ten-60.vercel.app — Hobby: 100 deploys/día; previews `cursor/**` desactivados |
| **SmartTaller** código `main` | ✅ PRs #13–#19 mergeados |
| SmartTaller Vercel | ✅ https://smarttaller.xyz — auto en `main`; PRs `cursor/**` no disparan preview |
| SmartTaller SQL en PC | ✅ `apps/smartaller/supabase/pc-deploy/` |
| **Puerto Libre** app `apps/importacion` | ⏳ PR extracción; Vercel proyecto nuevo |
| SmartTaller Stripe/Telegram prod | ⏳ env vars + webhooks |
| SmartTaller smoke test | ⏳ `npm run qa -- --url TU_DOMINIO` |

---

## SmartTaller (`apps/smartaller`) — micro-SaaS #2

| Tarea | Estado |
|-------|--------|
| Código en `main` | ✅ |
| PR pre-lanzamiento (#21) | ⏳ SmartBike shop auto, repuestos CRUD, pc-deploy, qa |
| Deploy Vercel (Git → `main`) | ✅ https://smarttaller.xyz — auto en `main`; PRs `cursor/**` no disparan preview |
| SQL instalación limpia | ✅ `supabase/setup-completo.sql` |
| SQL parche jul 5–10 (PC) | ✅ `supabase/pc-deploy/01-...` |
| SQL verificaciones (PC) | ✅ `pc-deploy/02` → `07` |
| Env vars Vercel + redeploy | ⏳ |
| Webhook Telegram + Stripe | ⏳ |
| Checklist lanzamiento | ✅ `docs/CHECKLIST-LANZAMIENTO.md` |
| QA script | ✅ `npm run qa` |
| CI GitHub Actions | ✅ `smartaller-ci.yml` (qa + build en PR/push) |

### En tu PC (Supabase SQL Editor)

1. Base nueva → `supabase/setup-completo.sql`
2. Base antigua (hasta 4 jul) → `pc-deploy/01-parche-migraciones-jul5-a-jul10.sql`
3. Verificar → `pc-deploy/02` a `07`
4. Guía: `pc-deploy/00-LEEME.md`

Detalle: `DEPLOY.md` · `docs/CHECKLIST-LANZAMIENTO.md` · Stripe: `docs/STRIPE-SETUP.md`

---

## Puerto Libre (`apps/importacion`) — micro-SaaS #3

| Tarea | Estado |
|-------|--------|
| Código extraído de SmartTaller | ⏳ este PR |
| Mismo Supabase (RLS / tablas) | ✅ no requiere SQL nuevo |
| Proyecto Vercel (root `apps/importacion`) | ⏳ crear |
| Env vars + Auth redirect URLs | ⏳ |
| Corte: `IMPORTACION_APP_URL` en SmartTaller | ⏳ después del primer deploy |

```bash
cd apps/importacion
npm install
npm run dev
```

Puerto: http://localhost:3004

---

## Semana 1–3 — Agente IA (`apps/web`)

| Área | Estado |
|------|--------|
| Deploy Vercel | ✅ web-sand-ten-60.vercel.app |
| RLS misiones | ⏳ `deploy-rls-d7.sql` |
| Serper API key | ⏳ opcional |
| Chat producción | ⏳ prueba manual en `/` |

Comandos:

```powershell
cd apps\web
npm run dev:local
npm run qa
```

```powershell
cd apps\smartaller
npm run dev
npm run qa
npm run qa -- --url https://TU-DOMINIO.vercel.app
```

---

*Pregunta "¿cómo va el plan?" para ver este archivo.*
