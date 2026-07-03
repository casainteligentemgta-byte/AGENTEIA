# Cronograma AGENTE IA

Stack: **Cursor** · **Gemini** (prompts/ideas) · **Supabase** · **Vercel** · OpenAI (chat)

---

## Semana 1 — Base estable

| Día | Tarea | Estado |
|-----|-------|--------|
| **D1** | Supabase: proyecto, migraciones, Realtime | ✅ Hecho (SQL ejecutado) |
| **D2** | Env vars + build local + Vercel | ✅ Supabase OK · ⚠️ OpenAI: pon clave real en Vercel |
| **D3** | Home con chat (`HomeClient`) | ✅ Hecho |
| **D4** | Deploy verde en Vercel | 🔄 Push en curso |
| D5 | Probar flujo completo en producción | ⏳ |

## Semana 2 — Pulido

| D6 | Auth OAuth + middleware | ⏳ |
| D7 | RLS revisado por usuario | ⏳ |
| D8 | Personalidad del agente (prompts) | ⏳ |
| D9 | UI/UX responsive | ⏳ |
| D10 | Actualizar Next.js (seguridad) | ⏳ |

## Semana 3 — Lanzamiento

| D11 | Búsqueda web (Serper) | ⏳ |
| D12 | Seed memoria inicial | ⏳ |
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
| Hoy | D2/D4: vars Vercel + push pendiente |

---

*Pregunta "¿cómo va el plan?" para ver este archivo actualizado.*
