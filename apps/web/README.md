# Agente AI (`apps/web`)

Chat con memoria vectorial, misiones y búsqueda web. Next.js 14 App Router, Vercel AI SDK v4, Supabase Auth + Postgres (pgvector). En producción usa **OpenRouter** vía `OPENAI_API_KEY`.

Proyecto Vercel: `web` · Root Directory: `apps/web` · URL: https://web-sand-ten-60.vercel.app

## Setup local

1. Copia variables:

   ```bash
   cp .env.example .env.local
   ```

2. Rellena al menos `OPENAI_API_KEY` (OpenRouter `sk-or-v1-...` o OpenAI), `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. Aplica el SQL en Supabase (SQL Editor o CLI):

   - Instalación limpia: pega `supabase/setup-completo.sql`
   - Proyecto que ya tiene las tablas: ejecuta `supabase/migrations/20261103120000_agent_memory_per_user.sql`

4. Instala y arranca:

   ```bash
   npm install
   npm run dev
   ```

   El dev server usa el puerto **3002**. Entra, inicia sesión y prueba el chat.

5. (Opcional) Memorias de sistema:

   ```bash
   # Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
   npm run seed:memory
   ```

## Variables de entorno

| Variable | Obligatoria | Notas |
|---|---|---|
| `OPENAI_API_KEY` | Sí (chat) | En producción: clave **OpenRouter** (`sk-or-v1-...`). Local: OpenRouter u OpenAI. |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Anon/publishable key. Nunca la service role. |
| `NEXT_PUBLIC_AGENT_NAME` | No | Nombre del agente en la UI. |
| `NEXT_PUBLIC_REQUIRE_AUTH` | No | Default **true**. `false` solo para ver la UI local sin login. `/api/chat` exige sesión igual. |
| `NEXT_PUBLIC_SITE_URL` | Prod | Referer de OpenRouter. |
| `SERPER_API_KEY` | No | Búsqueda web. Sin ella el chat sigue; `webSearch` avisa y no rompe. Añadir en Vercel. |
| `TAVILY_API_KEY` | No | Fallback si no hay Serper. |
| `CHAT_DAILY_MESSAGE_LIMIT` | No | Tope diario por usuario (default `50`). `0` = ilimitado. |
| `ENABLE_CREATE_FILE` | No | `createFile` está off en production (Vercel es read-only). `true` solo en local. |
| `SUPABASE_SERVICE_ROLE_KEY` | Seed | Solo servidor / script `seed:memory`. No exponer al cliente. |

## Auth, cuota y memoria

- `/` y `/agente` redirigen a `/login` si no hay sesión (salvo `NEXT_PUBLIC_REQUIRE_AUTH=false`).
- `POST /api/chat` rechaza 401 sin usuario y 429 si se supera el tope diario (`chat_usage` + RPC `consume_chat_quota`).
- `agent_memory.user_id`: `NULL` = memoria de sistema (seed, todos leen, nadie escribe con la anon key). UUID = memoria privada. RLS + `match_agent_memories` filtran por `auth.uid()`.

## Búsqueda web y archivos

- `SERPER_API_KEY` falta en producción hasta que el propietario la añada en Vercel. El tool degrada con un mensaje en español.
- `createFile` no se registra en production. El filesystem de Vercel no persiste escrituras.

## Health

`GET /api/agent-check` — env, Supabase y (opcional) `?probe=web` para Serper.

Más detalle de deploy: [DEPLOY.md](./DEPLOY.md). Supabase CLI: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).
