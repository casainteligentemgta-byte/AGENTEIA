# Checklist ejecutable — SmartTaller MVP en producción

Copia y marca cada ítem. Orden recomendado: **Supabase → Vercel → Webhooks → Redeploy → Smoke tests**.

---

## Fase 0 — Pre-requisitos

- [ ] Repo en `main` actualizado (incluye PRs #13–#19)
- [ ] Proyecto Vercel `smartaller` con **Root Directory** = `apps/smartaller`
- [ ] Proyecto Supabase creado (anotar URL + keys)
- [ ] Bot de Telegram creado con [@BotFather](https://t.me/BotFather)
- [ ] Cuenta Stripe (modo test para piloto)
- [ ] Dominio público definido (ej. `https://smartaller.vercel.app`)

---

## Fase 1 — Supabase: migraciones SQL

Ejecutar en **SQL Editor** en este orden. **Omitir** `20250703100000_auth_rls_policies.sql` (obsoleta).

| # | Archivo | Qué añade |
|---|---------|-----------|
| 1 | `20250702100000_create_mantenimientos.sql` | Tabla mantenimientos |
| 2 | `20250702110000_create_vehiculos_recordatorios.sql` | Vehículos + recordatorios |
| 3 | `20250704100000_multi_taller.sql` | Talleres, multi-tenant |
| 4 | `20250704110000_multivehiculo.sql` | Tipos vehículo, B2C |
| 5 | `20250704120000_centros_servicio.sql` | Centros + seed demo |
| 6 | `20250704130000_fix_talleres_telegram_nullable.sql` | Telegram nullable |
| 7 | `20250704140000_puente_taller_app.sql` | Puente taller ↔ app |
| 8 | `20250704150000_plataforma_hibrida.sql` | Perfiles, paywall |
| 9 | `20250704160000_seguridad_p0.sql` | Idempotencia Telegram |
| 10 | `20250704170000_rls_cleanup.sql` | Limpieza RLS legacy |
| 11 | `20250705100000_stripe_perfiles.sql` | Columnas Stripe |
| 12 | `20250706100000_mantenimientos_update_categorias.sql` | UPDATE categorías |
| 13 | `20250707100000_smartbike.sql` | SmartBike |
| 14 | `20250708100000_diagnostico_media.sql` | Bucket `diagnosticos` |
| 15 | `20250709100000_repuestos.sql` | Repuestos + líneas OS |
| 16 | `20250710100000_smartbike_vehiculo_link.sql` | Link bikes ↔ vehículos |

**Atajos** (si ya tienes base parcial):

- [ ] Si falta plataforma híbrida: `supabase/deploy-pr9.sql`
- [ ] Si falta Stripe: `supabase/deploy-stripe.sql`

**Opcional demo SmartBike:**

- [ ] `supabase/seed-smartbike.sql` (requiere al menos 1 usuario en Auth)

---

## Fase 2 — Supabase: verificaciones SQL

### 2.1 RLS sin políticas permisivas

Ejecutar `supabase/verificar-rls.sql`:

```sql
select tablename, policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('mantenimientos', 'vehiculos', 'recordatorios', 'talleres', 'perfiles')
  and roles @> '{authenticated}'
  and (qual = 'true' or qual is null);
```

- [ ] **Resultado: 0 filas**

### 2.2 Idempotencia Telegram

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname = 'idx_mantenimientos_telegram_msg';
```

- [ ] **Resultado: 1 fila** (`idx_mantenimientos_telegram_msg`)

### 2.3 Tablas nuevas presentes

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'repuestos', 'mantenimiento_repuestos',
    'bikes', 'bike_components', 'shops', 'maintenance_protocols'
  )
order by 1;
```

- [ ] **Resultado: 6 filas**

### 2.4 Bucket diagnósticos

```sql
select id, name, public
from storage.buckets
where id = 'diagnosticos';
```

- [ ] **Resultado: 1 fila**, `public = false`

### 2.5 Multi-taller

- [ ] Ejecutar `supabase/verificar-multi-taller.sql` → todos los checks en OK

---

## Fase 3 — Supabase Auth

En **Authentication → URL Configuration**:

| Campo | Valor |
|-------|-------|
| Site URL | `https://TU-DOMINIO.vercel.app` |
| Redirect URLs | `https://TU-DOMINIO.vercel.app/auth/callback` |
| | `http://localhost:3003/auth/callback` (dev) |

- [ ] Site URL configurada
- [ ] Redirect URLs añadidas
- [ ] Email confirmación: según preferencia (puede desactivarse en piloto)

---

## Fase 4 — Variables Vercel (Production)

**Settings → Environment Variables** — Root: `apps/smartaller`

### Obligatorias

| Variable | Notas |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | De @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | String aleatorio largo (≥32 chars) |
| `OPENAI_API_KEY` | Para facturas + chat |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Empieza por `eyJ` |
| `SUPABASE_URL` | Misma URL que arriba |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** — sin espacios |
| `NEXT_PUBLIC_APP_URL` | `https://TU-DOMINIO` sin barra final |
| `CRON_SECRET` | String aleatorio para `/api/cron/recordatorios` |

### Stripe (pagos reales)

| Variable | Notas |
|----------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` o `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` |
| `STRIPE_PRICE_ID` | `price_...` de SmartTaller Pro $2.99 |

### Opcionales

| Variable | Uso |
|----------|-----|
| `OPENAI_CHAT_MODEL` | Default: `gpt-4o-mini` |
| `CALLMEBOT_API_KEY` | WhatsApp pruebas |
| `PRESIDENCIA_PIN` | PIN kiosk recepción |
| `RESEND_API_KEY` + `RESEND_FROM` | Email recordatorios |
| `STRAVA_WEBHOOK_SECRET` | Solo si usas webhook SmartBike manual |

- [ ] Todas las obligatorias guardadas
- [ ] Stripe configurado (o decisión explícita de piloto sin pagos)
- [ ] **Redeploy** tras guardar variables

---

## Fase 5 — Webhooks externos

### 5.1 Telegram

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://TU-DOMINIO.vercel.app/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

- [ ] Respuesta JSON con `"ok": true`
- [ ] Verificar: `getWebhookInfo` muestra URL correcta

### 5.2 Stripe

En [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks):

| Campo | Valor |
|-------|-------|
| URL | `https://TU-DOMINIO.vercel.app/api/stripe/webhook` |
| Eventos | `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` |

- [ ] Endpoint creado
- [ ] `STRIPE_WEBHOOK_SECRET` copiado a Vercel
- [ ] Customer portal activado (Settings → Billing → Customer portal)

### 5.3 Cron Vercel

`vercel.json` ya define cron diario 14:00 UTC → `/api/cron/recordatorios`.

- [ ] Plan Vercel soporta crons (Pro o equivalente)
- [ ] `CRON_SECRET` configurado

---

## Fase 6 — Smoke tests post-deploy

Sustituye `TU-DOMINIO` por tu URL real.

### 6.1 Health check

```bash
curl -s https://TU-DOMINIO.vercel.app/api/health | jq
```

- [ ] `"status": "ok"`
- [ ] `"supabase": "ok"`
- [ ] `"telegram": "ok"`
- [ ] `"stripe": "ok"` (si aplica)

### 6.2 Landing y auth

| Paso | URL | Esperado |
|------|-----|----------|
| Landing B2C | `/` | Hero + CTA |
| Landing B2B | `/para-talleres` | Features + FAQ |
| Login | `/login` | Selector Taller / Dueño |
| Login taller | email magic link | Redirige a `/dashboard` |
| Login dueño | email magic link | Redirige a `/app` |

- [ ] Todas las rutas cargan sin 500

### 6.3 Flujo taller (B2B)

| # | Acción | Esperado |
|---|--------|----------|
| 1 | `/dashboard` → primer acceso | Crea taller automáticamente |
| 2 | Configuración | Ver `codigo_vinculo` |
| 3 | Telegram: `/vincular CODIGO` | Mensaje de éxito |
| 4 | Telegram: enviar foto factura | Confirmación + datos extraídos |
| 5 | Dashboard → Mantenimientos | Nueva OS visible |
| 6 | Dashboard → Vehículos | Vehículo creado/actualizado |
| 7 | Vehículo → subir foto diagnóstico | Upload OK |
| 8 | Vehículo → añadir repuesto a OS | Línea guardada |
| 9 | Dashboard → Recordatorios | Recordatorio generado (+6 meses) |
| 10 | `/presidencia/[tallerId]` | Kiosk con stats |

- [ ] Flujo Telegram completo OK
- [ ] Diagnóstico media visible
- [ ] Repuestos en OS OK

### 6.4 Flujo dueño (B2C)

| # | Acción | Esperado |
|---|--------|----------|
| 1 | `/app` sin vehículos | Paywall o CTA registrar |
| 2 | Registrar vehículo con placa del taller + `codigo_vinculo` | Vincula historial |
| 3 | Ficha vehículo | Historial, salud, categorías |
| 4 | Galería diagnóstico | Fotos del taller visibles |
| 5 | Repuestos en historial | Líneas de la OS |
| 6 | Chat Smartaller | Responde con contexto del vehículo |
| 7 | Timeline `/app/timeline` | Eventos filtrables |
| 8 | Bicicleta → SmartBike | Carnet + desgaste componentes |

- [ ] Vinculación con código funciona
- [ ] Historial del taller visible en app
- [ ] Chat responde

### 6.5 Portal cliente (sin login)

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | `/cliente` | Formulario placa + teléfono |
| 2 | Buscar con datos correctos | Historial resumido |

- [ ] Portal cliente OK

### 6.6 Stripe (si configurado)

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | `/app` → Activar Pro | Redirect a Stripe Checkout |
| 2 | Tarjeta test `4242...` | Vuelve a `/app?subscribed=1` |
| 3 | Registrar vehículo sin taller | Permitido con suscripción |
| 4 | Gestionar suscripción | Portal Stripe abre |

- [ ] Checkout + webhook + portal OK

### 6.7 Seguridad rápida

| Test | Comando / acción | Esperado |
|------|------------------|----------|
| Webhook sin secret | `POST /api/telegram-webhook` sin header | `401` o `503` |
| Cron sin secret | `GET /api/cron/recordatorios` | `401` |
| Placa ajena sin código | Registrar placa de otro sin `codigo_vinculo` | Error validación |

- [ ] Endpoints protegidos rechazan requests inválidos

---

## Fase 7 — Decisiones explícitas (piloto vs producción abierta)

Marca la decisión tomada:

| Riesgo | Opción piloto | Opción producción |
|--------|---------------|-------------------|
| Puente por placa | Aceptar: código por taller suficiente | OTP por SMS o código por vehículo |
| WhatsApp | CallMeBot solo pruebas | Twilio integrado |
| SmartBike Strava | Webhook manual / desactivado | OAuth Strava real |
| Paywall dev bypass | Solo en local sin Stripe | Stripe obligatorio en prod |

- [ ] Riesgo puente por placa: decisión documentada
- [ ] WhatsApp: canal definido para recordatorios
- [ ] Stripe: modo test vs live decidido

---

## Fase 8 — Post-lanzamiento inmediato (no bloqueante)

- [x] Añadir SmartBike al sidebar del dashboard
- [x] CRUD repuestos (editar stock, desactivar)
- [x] Actualizar `setup-completo.sql` con las 6 migraciones faltantes
- [ ] Actualizar `CRONOGRAMA.md` (sigue en PR #9)
- [x] `error.tsx` / `not-found.tsx` globales
- [ ] Tests smoke en CI

---

## Resumen express (5 minutos)

```
[ ] 16 migraciones en Supabase
[ ] verificar-rls.sql → 0 filas
[ ] Auth redirect URLs
[ ] 9 env vars obligatorias + 3 Stripe en Vercel
[ ] Redeploy
[ ] setWebhook Telegram con secret_token
[ ] Webhook Stripe
[ ] GET /api/health → ok
[ ] /vincular → foto → dashboard
[ ] /app → código → historial
```

---

## Referencias

- Deploy general: [`DEPLOY.md`](../DEPLOY.md)
- Stripe: [`STRIPE-SETUP.md`](STRIPE-SETUP.md)
- Auditoría seguridad: [`AUDITORIA-PRE-MVP.md`](AUDITORIA-PRE-MVP.md)
- Variables de entorno: [`.env.example`](../.env.example)
