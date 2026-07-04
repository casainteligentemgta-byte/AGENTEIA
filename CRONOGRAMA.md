# Cronograma AGENTE IA

Stack: **Cursor** · **Gemini** (ideas) · **Supabase** · **Vercel** · OpenRouter/OpenAI (chat)

---

## Estado actual (resumen)

| Área | Estado |
|------|--------|
| Código + GitHub | ✅ |
| Supabase nuevo (`quocxyesrdwfyeynegkd`) | ✅ URL + seed memoria (6) |
| OpenRouter (LLM) | ✅ local |
| Serper (web) | ⏳ falta API key |
| RLS misiones por usuario | ⏳ ejecutar SQL en Supabase |
| Vercel deploy | ✅ https://web-sand-ten-60.vercel.app |
| Vercel env vars | ✅ proyecto `web` |
| Chat probado end-to-end | ⏳ prueba en navegador (D5) |
| D14 Dominio | ⏳ opcional |

---

## Semana 1 — Base estable

| Día | Tarea | Estado |
|-----|-------|--------|
| D1 | Supabase SQL | ✅ |
| D2 | Env vars | ✅ local · ⏳ Vercel |
| D3 | Home chat | ✅ |
| D4 | Deploy Vercel | ✅ web-sand-ten-60.vercel.app |
| D5 | Probar chat producción | ⏳ abre / y prueba mensaje |

## Semana 2 — Pulido

| Día | Tarea | Estado |
|-----|-------|--------|
| D6 | Auth OAuth | ✅ |
| D7 | RLS por usuario | ⏳ ejecutar migración SQL |
| D8–D10 | Prompts, responsive, Next 14.2.35 | ✅ |

## Semana 3 — Lanzamiento

| Día | Tarea | Estado |
|-----|-------|--------|
| D11 | Serper | ✅ código · ⏳ API key |
| D12 | Seed memoria | ✅ 6 memorias |
| D13 | QA | ✅ |
| D14 | Dominio | ⏳ opcional |

---

## Lo que falta (acción tuya)

### 1. SQL RLS en Supabase (2 min)
Si ya ejecutaste `setup-completo.sql` **antes** del fix D7, pega en SQL Editor:
`apps/web/supabase/migrations/20250703160000_missions_rls_by_user.sql`

### 2. Vercel — Environment Variables
Root Directory: `apps/web`

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_AGENT_NAME` | Cientifico Loco |
| `OPENAI_API_KEY` | tu sk-or-v1-... |
| `NEXT_PUBLIC_SUPABASE_URL` | https://quocxyesrdwfyeynegkd.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_REQUIRE_AUTH` | false |
| `SERPER_API_KEY` | opcional |

→ **Redeploy** tras guardar.

### 3. Serper (opcional)
[serper.dev](https://serper.dev) → `SERPER_API_KEY` en `.env.local` y Vercel.

### 4. Dev local (red UniFi / proxy SSL)
```powershell
cd apps\web
npm run dev:local
```
No uses `NODE_TLS_REJECT_UNAUTHORIZED` manual; usa `dev:local` / `seed:memory:local`.

### 5. Seguridad
- Rotar **Telegram bot token** y **Supabase service role** si los expusiste (ya eliminados de `.env.local`).
- Redirect URLs en Supabase Auth: `http://localhost:3002/auth/callback` + tu URL Vercel.

### 6. Probar
- `/` y `/agente` → chat responde
- `/login` → email/Google
- `/api/agent-check`
- Agente asigna misión (logueado)

---

## Comandos útiles

```powershell
cd apps\web
npm run dev:local          # dev con SSL local
npm run qa                 # checks estáticos
npm run seed:memory:local  # re-seed si hace falta
npm run test:serper        # cuando tengas Serper
```

---

*Pregunta "¿cómo va el plan?" para ver este archivo.*
