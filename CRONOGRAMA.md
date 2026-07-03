# Cronograma AGENTE IA

Stack: **Cursor** · **Gemini** (prompts/ideas) · **Supabase** · **Vercel** · OpenAI (chat)

---

## Semana 1 — Base estable

| Día | Tarea | Estado |
|-----|-------|--------|
| **D1** | Supabase: proyecto, migraciones, Realtime | ✅ Hecho (SQL ejecutado) |
| **D2** | Env vars + build local + Vercel | ✅ Supabase OK · ⚠️ OpenAI real en Vercel si el chat falla |
| **D3** | Home con chat (`HomeClient`) | ✅ Hecho |
| **D4** | Deploy verde en Vercel | ✅ Web carga |
| **D5** | Probar flujo completo en producción | 🔄 Falta OpenAI → luego probar chat |

## Semana 2 — Pulido

| Día | Tarea | Estado |
|-----|-------|--------|
| **D6** | Auth OAuth + middleware | ✅ Email/Google configurado por usuario |
| D7 | RLS revisado por usuario | ✅ Migración lista (ejecutar SQL) |
| D8 | Personalidad del agente (prompts) | ✅ Hecho |
| D9 | UI/UX responsive | ✅ Tabs móvil /agente, home optimizado |
| D10 | Actualizar Next.js (seguridad) | ✅ 14.2.35 en package.json |

---

## D6 — Auth (activar en Supabase — 2 min)

### Email + contraseña (más rápido)
1. Supabase → **Authentication → Providers → Email** → **Enable**
2. (Opcional dev) Desactiva **Confirm email** para entrar sin confirmar correo
3. En la app: **/login** → **Regístrate** con tu email → **Entrar con email**

### Google OAuth
1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → **OAuth consent screen** → crear app
2. **Credentials → Create OAuth client ID** → Web application
3. **Authorized redirect URI:** `https://TU-PROYECTO.supabase.co/auth/v1/callback`  
   (copia la exacta en Supabase → Authentication → Google → Callback URL)
4. Supabase → **Authentication → Providers → Google** → pega Client ID y Secret → **Enable**
5. **URL Configuration → Redirect URLs:**
   - `http://localhost:3002/auth/callback`
   - `https://TU-URL.vercel.app/auth/callback`
6. Prueba **/login → Continuar con Google**

---

## D7 — RLS por usuario (ejecutar en Supabase)

Pega y ejecuta: `apps/web/supabase/migrations/20250703160000_missions_rls_by_user.sql`

Cada usuario solo ve/edita sus misiones. El agente asigna misiones con tu `user_id` al estar logueado.

---

## OpenAI — pendiente (D5)

1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → clave `sk-proj-...`
2. `.env.local` + Vercel → `OPENAI_API_KEY`
3. Redeploy y probar chat en `/` o `/agente`

---

## D11 — Serper (búsqueda web)

1. [serper.dev](https://serper.dev) → registro → copia API key
2. `.env.local` + Vercel → `SERPER_API_KEY`
3. Prueba local: `npm run test:serper`
4. Health check: `/api/agent-check?probe=web`

El agente usa `webSearch` automáticamente para noticias, docs y competencia.

## D12 — Seed memoria

Requiere `OPENAI_API_KEY` real y Supabase con `setup-completo.sql` ejecutado.

```bash
cd apps/web
npm run seed:memory              # inserta solo las nuevas
npm run seed:memory -- --dry-run # vista previa
```

Memorias editables en `lib/ai/seed-memories.ts`.

---

## Semana 3 — Lanzamiento

| Día | Tarea | Estado |
|-----|-------|--------|
| D11 | Búsqueda web (Serper) | ✅ lib/ai/web-search + test:serper |
| D12 | Seed memoria inicial | ✅ script + 6 memorias base |
| D13 | QA completo | ⏳ |
| D14 | Dominio (opcional) | ⏳ |

---

## D1 — Supabase (qué hacer tú)

1. [supabase.com](https://supabase.com) → **New project**
2. **Project Settings → API** → copia **Project URL** y **anon public key**
3. **SQL Editor** → pega y ejecuta: `apps/web/supabase/setup-completo.sql`
4. **Database → Publications → supabase_realtime** → activa tabla `agent_missions` (opcional, para misiones en vivo)

## D2 — Variables de entorno

En `apps/web/.env.local` y en **Vercel → Settings → Environment Variables**:

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_AGENT_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SERPER_API_KEY` (opcional)

Vercel: **Root Directory** = `apps/web`

## D3 — Home

La ruta `/` usa `HomeClient` (chat + sidebar). Vista gaming en `/agente`.

---

## Avance registrado

| Fecha | Hecho |
|-------|-------|
| — | Repo GitHub + Vercel configurado |
| — | Fix build: `toDataStreamResponse`, tipo `cookiesToSet` |
| Hoy | D1: SQL ejecutado en Supabase ✅ |
| Hoy | D3: `/` con `HomeClient` |
| Hoy | D4: web carga en Vercel ✅ |
| Hoy | D6: login email/Google activado ✅ |
| Hoy | D7-D8: RLS + prompt Científico Loco ✅ |
| Hoy | D9-D10: responsive + Next 14.2.35 ✅ |
| Hoy | D11-D12: Serper + seed memoria ✅ |
| Hoy | D5 pendiente: OpenAI para chat |
| Hoy | D7 pendiente: ejecutar SQL RLS en Supabase |

---

*Pregunta "¿cómo va el plan?" para ver este archivo actualizado.*
