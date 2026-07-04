# SmartTaller — Auditoría técnica pre-MVP

**Fecha:** 4 de julio de 2026  
**Stack:** Antigravity (Next.js 14 App Router, Supabase, Tailwind, TypeScript, Server Actions)  
**Alcance:** `apps/smartaller` — dashboard taller (`/dashboard`), app B2C (`/app`), webhook Telegram, puente por placa, Chat Smartaller  
**Objetivo:** Identificar bugs, deuda técnica crítica y fallos de seguridad antes del deploy MVP en Vercel.

---

## Resumen ejecutivo

El proyecto está bien encaminado en arquitectura (Server Actions, Zod en formularios B2C, RLS multi-taller, `waitUntil` en webhook). **Hay 2 blockers de seguridad** que deben resolverse o aceptarse explícitamente antes del launch:

1. **Puente por placa sin verificación de propiedad** — cualquier usuario B2C puede registrar una placa ajena y ver historial de taller de terceros.
2. **Webhook Telegram con secret opcional** — si falta `TELEGRAM_WEBHOOK_SECRET`, el endpoint acepta POST falsos con service role.

El resto son parches pequeños (recordatorios mal filtrados, token de Telegram expuesto a OpenAI, idempotencia de facturas).

---

## 1. SEGURIDAD Y RLS

### ✅ Lo que funciona

| Área | Implementación |
|------|----------------|
| Multi-taller dashboard | Políticas `taller_id = get_my_taller_id()` en `vehiculos`, `mantenimientos`, `recordatorios` (`20250704100000_multi_taller.sql`) |
| App B2C | CRUD de vehículos con `user_id = auth.uid()` (`20250704110000_multivehiculo.sql`) |
| Webhook / puente | Escrituras sensibles vía `createAdminClient()` (service role), no expuesto al navegador |
| Rutas protegidas | Middleware exige sesión en `/dashboard` y `/app` (`lib/supabase/middleware.ts`) |
| Vinculación Telegram | Código único por taller; un chat no puede vincularse a dos talleres (`lib/taller.ts`) |

### 🔴 CRÍTICO — Puente por placa sin prueba de propiedad

**Archivos:** `app/actions/vehicles.ts`, `supabase/migrations/20250704130000_puente_taller.sql`, `lib/process-invoice.ts`

**Problema:** Cualquier usuario autenticado en `/app` puede registrar una placa que no le pertenece. El sistema:

1. Busca vehículo del taller con esa placa (`user_id` null).
2. Le asigna `user_id` al atacante vía service role.
3. RLS `mantenimientos select by owner placa` expone **todos** los mantenimientos con esa placa, de **cualquier taller**.

**Datos expuestos:** historial de servicios, costos, nombres y teléfonos de clientes del taller.

**Amplificador:** Chat Smartaller (`/api/chat`) inyecta ese historial en el system prompt de OpenAI.

**Mitigación mínima pre-launch (elegir una):**

- **A)** Desactivar política `mantenimientos select by owner placa` hasta tener verificación (código del taller / OTP).
- **B)** Leer mantenimientos solo por `vehiculo_id` del vehículo del usuario, nunca solo por string `placa`.
- **C)** Aceptar el riesgo documentado solo en entorno demo/piloto cerrado.

---

### 🔴 CRÍTICO — Webhook Telegram sin secret obligatorio

**Archivo:** `app/api/telegram-webhook/route.ts` (líneas 67–73)

```typescript
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (secret) {
  // valida header
}
// Si secret no existe → acepta cualquier POST
```

**Impacto:** Atacante puede simular updates de Telegram → inserts en Supabase con service role (mantenimientos, vehículos, recordatorios falsos).

**Fix mínimo (3 líneas):** En producción, si `!secret` → responder `503` (fail-closed). Configurar webhook con `secret_token`:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<DOMINIO>/api/telegram-webhook&secret_token=<SECRET>"
```

---

### 🟠 ALTO — Políticas RLS legacy `using (true)`

**Archivo:** `supabase/migrations/20250703100000_auth_rls_policies.sql`

Creó SELECT global para `authenticated`. La migración `multi_taller` las elimina, pero **si en producción quedó alguna política `using (true)`**, PostgreSQL hace OR entre políticas → fuga total entre talleres.

**Verificación obligatoria en Supabase SQL Editor:**

```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND roles @> '{authenticated}'
  AND qual = 'true';
```

**Resultado esperado:** 0 filas en `mantenimientos`, `vehiculos`, `recordatorios`.

---

### 🟠 ALTO — Token de Telegram enviado a OpenAI

**Archivo:** `lib/telegram.ts` → `getTelegramFileUrl()` devuelve URL con token embebido:

```
https://api.telegram.org/file/bot<TOKEN>/<file_path>
```

Esa URL se pasa a OpenAI Vision (`lib/extract-invoice.ts`). El token del bot queda expuesto a logs de terceros.

**Fix:** Usar `downloadTelegramFile()` + data URL base64 (función ya existe en el mismo archivo).

---

### 🟡 MEDIO — Colisión de placas entre usuarios B2C

**Índice:** `idx_vehiculos_placa_usuario` permite que dos usuarios distintos registren la misma placa.

**Archivo:** `lib/process-invoice.ts` — `findOrCreateVehiculo()` usa `.maybeSingle()` al buscar vehículo de usuario por placa. Con 2+ filas → error → webhook falla al procesar factura.

---

### 🟡 MEDIO — Chat Smartaller sin rate limit

**Archivo:** `app/api/chat/route.ts`

Cualquier usuario logueado puede consumir créditos OpenAI sin límite. Mitigar post-MVP con rate limit o cuota por usuario.

---

## 2. ROBUSTEZ EN PRODUCCIÓN

### Flujo de facturas

```
Telegram POST
  → waitUntil (respuesta 200 rápida) ✅
  → getTelegramFileUrl
  → OpenAI Vision (gpt-4o-mini)
  → processInvoice (Supabase)
  → CallMeBot WhatsApp (opcional)
  → sendTelegramMessage
```

**Nota:** No existe integración Resend en el repo. Solo CallMeBot para WhatsApp (`lib/whatsapp.ts`).

### Puntos ciegos

| Riesgo | Severidad | Detalle |
|--------|-----------|---------|
| Timeout Vercel | Media | `maxDuration = 60`. OpenAI Vision lento puede cortarse en plan Hobby. Monitorear logs. |
| Sin idempotencia | Alta | No hay `UNIQUE (telegram_chat_id, telegram_message_id)`. Reintentos Telegram = mantenimientos duplicados. |
| Sin transacción | Media | `processInvoice` hace 3+ writes secuenciales. Fallo intermedio = datos huérfanos. |
| `placa` null | OK | Validado antes de escribir. |
| CallMeBot falla | OK | No bloqueante; solo log. |
| Taller no vinculado | OK | Mensaje claro al usuario Telegram. |
| Bug recordatorios B2C | Alta | `lib/data/vehicle-history.ts` líneas 100–105: query global `.limit(1)` sin filtrar por `vehiculo_id` ni placa. UI y Chat pueden mostrar recordatorio de otro vehículo. |

---

## 3. CLEAN CODE / CONVENCIONES ANTIGRAVITY

### ✅ Correcto

- Server Actions con `"use server"`, auth en servidor, `revalidatePath`.
- Zod en `createVehicle` (`lib/validations/vehicle.ts`).
- `useTransition` en `AddVehicleForm` y `ConfigForm`.
- Server Components por defecto en dashboard y `/app`.
- Chat con API Route + streaming (adecuado para AI SDK v7).
- Sanitización de env vars Supabase (`lib/supabase/env.ts`).

### ⚠️ Mejorable (no bloqueante MVP)

- `updateNombreTallerAction(nombre: string)` sin validación Zod.
- `lib/data/dashboard.ts` traga errores → dashboard muestra ceros sin aviso.
- Dashboard sin `loading.tsx` (B2C sí lo tiene).
- Tipos Supabase no generados (`supabase gen types typescript`).

---

## 4. ACCIONES INMEDIATAS — ANTES DE PUSH A MAIN

### P0 — Bloquean launch seguro

| # | Acción | Archivo / ubicación | Esfuerzo |
|---|--------|---------------------|----------|
| 1 | Obligar `TELEGRAM_WEBHOOK_SECRET` en prod (fail-closed) | `app/api/telegram-webhook/route.ts` | ~5 min |
| 2 | Auditar políticas RLS en Supabase (query arriba) | Supabase Dashboard | ~10 min |
| 3 | Acotar puente por placa (ver opciones A/B/C en §1) | Migración + `vehicle-history.ts` | 1–2 h |
| 4 | Filtrar recordatorios por `vehiculo_id` | `lib/data/vehicle-history.ts` | ~15 min |
| 5 | No pasar URL con bot token a OpenAI | `app/api/telegram-webhook/route.ts` + `extract-invoice.ts` | ~30 min |

### P1 — Robustez (diff pequeño)

| # | Acción |
|---|--------|
| 6 | Índice único: `(telegram_chat_id, telegram_message_id)` en `mantenimientos` |
| 7 | Early return en `processInvoice` si factura ya procesada |
| 8 | Checklist env Vercel + 8 migraciones en orden |

**Orden migraciones:**

1. `20250702100000_create_mantenimientos.sql`
2. `20250702110000_create_vehiculos_recordatorios.sql`
3. `20250703100000_auth_rls_policies.sql`
4. `20250704100000_multi_taller.sql`
5. `20250704110000_multivehiculo.sql`
6. `20250704120000_centros_servicio.sql`
7. `20250704130000_puente_taller.sql`
8. `20250704130000_fix_talleres_telegram_nullable.sql`

### P2 — Post-MVP

- Verificación de propiedad de placa (OTP / código taller).
- Rate limit en `/api/chat`.
- Transacción atómica en `processInvoice`.
- Tipos generados Supabase.

---

## Variables de entorno (Vercel)

```env
TELEGRAM_BOT_TOKEN=          # Obligatorio
TELEGRAM_WEBHOOK_SECRET=     # Obligatorio en prod
OPENAI_API_KEY=              # Obligatorio
NEXT_PUBLIC_SUPABASE_URL=    # Obligatorio
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Obligatorio (eyJ...)
SUPABASE_URL=                # Obligatorio
SUPABASE_SERVICE_ROLE_KEY=   # Obligatorio (eyJ..., sin viñetas)
CALLMEBOT_API_KEY=           # Opcional (WhatsApp)
OPENAI_CHAT_MODEL=           # Opcional (default gpt-4o-mini)
```

**Root Directory Vercel:** `apps/smartaller`

---

## Checklist deploy express

```
[ ] 8 migraciones aplicadas en Supabase
[ ] pg_policies sin using(true) en tablas core
[ ] TELEGRAM_WEBHOOK_SECRET + setWebhook con secret_token
[ ] OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY válidas
[ ] Probar: /vincular CODIGO → foto factura → dashboard actualizado
[ ] Probar: /app → vehículo → ficha → chat (color correcto)
[ ] Decisión explícita sobre riesgo puente por placa (P0 #3)
```

---

## Archivos clave revisados

| Archivo | Rol |
|---------|-----|
| `supabase/migrations/20250704100000_multi_taller.sql` | RLS multi-taller |
| `supabase/migrations/20250704110000_multivehiculo.sql` | RLS B2C |
| `supabase/migrations/20250704130000_puente_taller.sql` | Puente placa |
| `app/api/telegram-webhook/route.ts` | Webhook Telegram |
| `lib/process-invoice.ts` | Pipeline factura |
| `lib/extract-invoice.ts` | OpenAI Vision |
| `lib/whatsapp.ts` | CallMeBot |
| `app/actions/vehicles.ts` | Alta B2C + puente |
| `lib/data/vehicle-history.ts` | Historial app dueño |
| `app/api/chat/route.ts` | Chat Smartaller |
| `lib/data/dashboard.ts` | Stats taller |
| `lib/supabase/middleware.ts` | Auth rutas |
| `.env.example` | Variables |

---

## Veredicto final

**Estado:** Casi listo para MVP piloto, **no** para producción abierta sin parches P0.

**Prioridad absoluta:** webhook fail-closed + decisión sobre puente por placa + auditoría RLS en Supabase.

**Tiempo estimado parches P0:** 2–4 horas de desarrollo + verificación en staging.

---

*Documento generado para handoff a Gemini / revisión pre-deploy. Proyecto: SmartTaller — monorepo AGENTEIA, app en `apps/smartaller`.*
