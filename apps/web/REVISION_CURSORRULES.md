# Revisión del proyecto Agente IA según .cursorrules

## 1. Supabase Workflow (RLS)

| Tabla | RLS | Estado |
|-------|-----|--------|
| `agent_missions` | Sí | Migración con políticas SELECT/INSERT/UPDATE. Falta DELETE si se usa. |
| `agent_profile` | **No** | Sin RLS; `getAgentStatus()` lee de esta tabla. Riesgo si anon key está expuesto. |
| `agent_memory` | **Sin migración** | Tabla usada en `memory.ts`, `agent-status.ts` y `api/chat` pero no hay migración en repo. RLS no definido. |

**Acción:** Añadir migración para `agent_memory` (tabla + función `match_agent_memories` + RLS) y migración que active RLS en `agent_profile` con políticas adecuadas.

---

## 2. Seguridad

- **Server Actions:** `getAgentStatus`, `getMissions` y `updateMissionStatus` no verifican sesión con `getUser()` antes de leer/escribir. Las rules exigen validar sesión en operaciones que acceden a recursos protegidos.
- **API `/api/chat`:** No valida sesión antes de ejecutar herramientas (createFile, assignMission, listMissions). createFile escribe en disco; assignMission inserta en DB.
- **Middleware:** No refresca sesión Supabase (está comentado). No hay `updateSession` con `createServerClient`.

**Acción:** Verificar sesión en `updateMissionStatus` (y opcionalmente filtrar `getMissions` por `user_id`). En `/api/chat`, considerar validar auth si las herramientas son sensibles. Implementar refresh de sesión en middleware si se usa auth.

---

## 3. Validación (Zod)

- **missions.ts:** `updateMissionStatus(id, status)` recibe params sin validar. Debería usar `z.object({ id: z.string().uuid(), status: z.enum(['pending','completed']) })`.
- **api/chat/route.ts:** El body `{ messages }` no se valida con Zod; solo se usa. Las tools sí usan `zodSchema` en params.
- **agent-status.ts:** Solo lectura, sin input; no aplica Zod.

**Acción:** Añadir esquema Zod en `updateMissionStatus` y validar con `safeParse`; devolver `{ ok: false, error }` si falla.  
**Hecho:** Validación Zod (id uuid, status enum) y verificación de sesión (`getUser()`); si no hay usuario se devuelve error. Actualizar misiones requiere estar autenticado.

---

## 4. Arquitectura

- **API Route `/api/chat`:** Las rules dicen evitar API Routes salvo webhooks/OAuth/integraciones. El chat con Vercel AI SDK (`useChat` → POST) es un caso aceptable de integración; mantener pero documentar.
- **Server vs Client:** Las páginas `app/page.tsx` y `app/agente/page.tsx` son 100% `"use client"`. Podrían ser Server Components que solo renderizan `<AgentStatus />`, `<MissionBoard />`, `<ChatUI />` (client components), reduciendo JS en el cliente y alineando con server-first.

---

## 5. Estructura de archivos

- **hooks:** No existe carpeta `hooks`. Lógica de “cargar misiones” está duplicada en `MissionBoard` y `MissionControl` (DRY).
- **types:** `Mission` y `AgentStatusData` están definidos en los actions. Las rules prefieren tipos generados por `supabase gen types typescript` o centralizar en `types/`.
- **components/ui:** No hay Shadcn/UI instalado; solo Tailwind + Lucide. Coherente con “preferred” si se añade después.

---

## 6. Tipado

- **TypeScript:** `strict: true` en tsconfig ✅.
- No hay tipos generados de Supabase (`supabase gen types typescript`). Tipos de tablas definidos a mano en actions.

---

## 7. Cliente Supabase

- **server:** `lib/supabase/server.ts` usa `createServerClient` de `@supabase/ssr` y cookies ✅.
- **client:** `lib/supabase/client.ts` usa `createBrowserClient` ✅.
- **Uso:** Server Actions y API route usan `createClient()` de server ✅. Login y Realtime (MissionControl) usan client ✅.

---

## 8. Resumen de acciones prioritarias

1. **Hecho:** Migración `20250209200000_create_agent_memory.sql` (tabla, RLS, RPC `match_agent_memories`).
2. **Hecho:** Migración `20250209210000_agent_profile_rls.sql` activa RLS en `agent_profile`.
3. **Hecho:** Zod y sesión en `updateMissionStatus` (requiere usuario autenticado para actualizar).
4. **Pendiente (opcional):** Validar sesión en POST `/api/chat` o en herramientas sensibles (createFile, assignMission).
5. **Medio:** Refresco de sesión en middleware si se usa auth.
6. **Bajo:** Extraer hook `useMissions()` para no duplicar lógica entre MissionBoard y MissionControl; considerar tipos generados por Supabase.
