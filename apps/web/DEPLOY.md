# Deploy Vercel — AGENTE IA (apps/web)

## URL de producción (activa)

**https://web-sand-ten-60.vercel.app**

- Health: `/api/agent-check`
- Chat: `/` y `/agente`
- Login: `/login`

## Proyecto Vercel

| Campo | Valor |
|-------|--------|
| Proyecto | `web` (team: luis-vicente-mata-ortizs-projects) |
| Root Directory | `apps/web` (al conectar Git) |
| Framework | Next.js |

> La URL antigua `agenteia-vert.vercel.app` apuntaba a un proyecto sin deploys. Usa la URL de arriba.

## Variables de entorno (Production)

- `NEXT_PUBLIC_AGENT_NAME`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_REQUIRE_AUTH`

## Deploy manual (CLI)

```powershell
cd apps\web
npx vercel deploy --prod --yes
```

## Conectar GitHub (recomendado)

Vercel Dashboard → proyecto **web** → Settings → Git → Connect **AGENTEIA** → Root Directory: **apps/web**

## Supabase Auth redirect

```
https://web-sand-ten-60.vercel.app/auth/callback
http://localhost:3002/auth/callback
```
